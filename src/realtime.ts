import type {
  BargeInEvent,
  DirectiveEvent,
  ProsodyEvent,
  ServerErrorEvent,
  SessionEndEvent,
  SpeakerProfilesEvent,
  SpeakerUpdateEvent,
  StateDeltaEvent,
  TranscriptUpdateEvent,
  TurnBoundaryEvent,
  WarningEvent,
} from './types.js';
import { parseProsodyEvent } from './session.js';
import { VoiceFrame } from './step.js';
import type { Conversation } from './conversation.js';

export type RealtimeEncoding = 'pcm16' | 'linear16' | 'opus';

export interface ProsodyRealtimeConfig {
  apiKey: string;
  baseUrl?: string;
  sessionId?: string;
  /** Defaults to pcm16 at 16 kHz mono for live analysis ingress. */
  encoding?: RealtimeEncoding;
  sampleRate?: number;
  /** Required when encoding is opus (`ogg` or `webm`). */
  container?: 'ogg' | 'webm';
  analysisMode?: string;
  source?: string;
  /** Match demo stream-file seek: analysis clock starts at this offset. */
  sourceOffsetMs?: number;
  /** Analysis chunk length in seconds. Defaults to 1. */
  chunkSeconds?: number;
  /** WebSocket constructor. Inject in tests; defaults to global WebSocket. */
  WebSocketImpl?: typeof WebSocket;
}

export interface ProsodyRealtimeHandlers {
  onConfigAck?: (event: Record<string, unknown>) => void;
  onDirective?: (event: DirectiveEvent) => void;
  onVoiceFrame?: (frame: VoiceFrame) => void;
  conversation?: Conversation;
  onTranscriptUpdate?: (event: TranscriptUpdateEvent) => void;
  onSpeakerUpdate?: (event: SpeakerUpdateEvent) => void;
  onSpeakerProfiles?: (event: SpeakerProfilesEvent) => void;
  /** The lane's state moved decisively against its own baseline. */
  onStateDelta?: (event: StateDeltaEvent) => void;
  /** The model committed the floor passing between voices. */
  onTurnBoundary?: (event: TurnBoundaryEvent) => void;
  /** A second voice entered against held speech. */
  onBargeIn?: (event: BargeInEvent) => void;
  onSessionEnd?: (event: SessionEndEvent) => void;
  /** Fired on `frame_ack` (and after directives) for paced file replay. */
  onFrameAck?: (event: Record<string, unknown>) => void;
  onWarning?: (event: WarningEvent) => void;
  onServerError?: (event: ServerErrorEvent) => void;
  onEvent?: (event: ProsodyEvent | Record<string, unknown>) => void;
  onError?: (error: Error) => void;
  onClose?: (code: number, reason: string) => void;
}

/**
 * Lower-level live analysis client for `WS /v1/stream/realtime`.
 *
 * Trusted servers and Node workers supply a developer `psk_*` key. Browser
 * LiveKit clients mint a room and consume republished events with
 * `ProsodySession`.
 */
export class ProsodyRealtimeStream {
  private readonly config: ProsodyRealtimeConfig;
  private readonly handlers: ProsodyRealtimeHandlers;
  private socket: WebSocket | null = null;
  private opened = false;
  private closed = false;

  constructor(config: ProsodyRealtimeConfig, handlers: ProsodyRealtimeHandlers = {}) {
    if (!config.apiKey) {
      throw new Error('ProsodyRealtimeStream requires apiKey');
    }
    this.config = config;
    this.handlers = handlers;
  }

  get sessionId(): string | undefined {
    return this.config.sessionId;
  }

  get readyState(): number {
    return this.socket?.readyState ?? WebSocket.CLOSED;
  }

  /** Open the socket and send the config frame. Resolves on `config_ack`. */
  connect(): Promise<Record<string, unknown>> {
    if (this.socket) {
      return Promise.reject(new Error('ProsodyRealtimeStream already connected'));
    }
    const WS = this.config.WebSocketImpl ?? WebSocket;
    if (!WS) {
      return Promise.reject(new Error('WebSocket is not available in this runtime'));
    }

    const url = realtimeWsUrl(this.config.baseUrl ?? 'https://api.prosodyai.app');
    const socket = new WS(url);
    this.socket = socket;
    this.closed = false;

    return new Promise((resolve, reject) => {
      let settled = false;

      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      socket.onopen = () => {
        this.opened = true;
        try {
          socket.send(JSON.stringify(this.buildConfig()));
        } catch (error) {
          fail(toError(error));
        }
      };

      socket.onmessage = (event) => {
        try {
          const payload = decodeSocketData(event.data);
          if (!isRecord(payload) || typeof payload.type !== 'string') {
            return;
          }
          this.handlers.onEvent?.(payload as ProsodyEvent | Record<string, unknown>);

          if (payload.type === 'config_ack') {
            if (!settled) {
              settled = true;
              resolve(payload);
            }
            this.handlers.onConfigAck?.(payload);
            return;
          }

          if (payload.type === 'frame_ack') {
            this.handlers.onFrameAck?.(payload);
            return;
          }

          if (
            payload.type === 'error'
            || payload.type === 'warning'
            || payload.type === 'directive'
            || payload.type === 'transcript_update'
            || payload.type === 'speaker_update'
            || payload.type === 'speaker_profiles'
            || payload.type === 'session_end'
          ) {
            // Wire events may omit generation/seq; parseProsodyEvent allows that.
            const parsed = parseProsodyEvent(payload);
            this.dispatch(parsed);
            if (payload.type === 'error' && !settled) {
              fail(new Error(String(payload.message ?? 'Realtime stream error')));
            }
          }
        } catch (error) {
          const err = toError(error);
          this.handlers.onError?.(err);
          if (!settled) fail(err);
        }
      };

      socket.onerror = () => {
        fail(new Error('ProsodyRealtimeStream WebSocket error'));
      };

      socket.onclose = (event) => {
        this.closed = true;
        this.opened = false;
        this.handlers.onClose?.(event.code, event.reason);
        if (!settled) {
          fail(new Error(`ProsodyRealtimeStream closed before config_ack (${event.code})`));
        }
      };
    });
  }

  /** Send mono PCM16 (or Opus container) audio bytes. */
  sendAudio(chunk: ArrayBuffer | Uint8Array | Buffer): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('ProsodyRealtimeStream is not open');
    }
    if (chunk instanceof Uint8Array) {
      this.socket.send(chunk);
      return;
    }
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(chunk)) {
      this.socket.send(chunk);
      return;
    }
    this.socket.send(chunk);
  }

  /** Ask the server for `session_end` and close after. */
  end(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type: 'end' }));
  }

  /** Send one JSON control frame as a text message (e.g. `voice_profile_update`). */
  sendControl(message: Record<string, unknown>): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(message));
  }

  close(code = 1000, reason = 'client_close'): void {
    if (this.closed || !this.socket) return;
    this.closed = true;
    try {
      this.socket.close(code, reason);
    } catch {
      // ignore
    }
    this.socket = null;
  }

  private buildConfig(): Record<string, unknown> {
    const encoding = (this.config.encoding ?? 'pcm16').toLowerCase() as RealtimeEncoding;
    const sampleRate = this.config.sampleRate ?? 16_000;
    const config: Record<string, unknown> = {
      type: 'config',
      api_key: this.config.apiKey,
      encoding,
      sample_rate: sampleRate,
      source: this.config.source ?? 'sdk',
    };
    if (this.config.sessionId) config.session_id = this.config.sessionId;
    if (this.config.analysisMode) config.analysis_mode = this.config.analysisMode;
    if (this.config.sourceOffsetMs != null) {
      config.source_offset_ms = this.config.sourceOffsetMs;
    }
    if (this.config.chunkSeconds != null) {
      config.chunk_seconds = this.config.chunkSeconds;
    }
    if (encoding === 'opus') {
      config.container = this.config.container ?? 'ogg';
    }
    return config;
  }

  private dispatch(event: ProsodyEvent): void {
    switch (event.type) {
      case 'directive': {
        this.handlers.onDirective?.(event);
        const frame = VoiceFrame.fromDirective(event);
        this.handlers.onVoiceFrame?.(frame);
        this.handlers.conversation?.apply(event);
        break;
      }
      case 'transcript_update':
        this.handlers.onTranscriptUpdate?.(event);
        this.handlers.conversation?.apply(event);
        break;
      case 'speaker_update':
        this.handlers.onSpeakerUpdate?.(event);
        this.handlers.conversation?.apply(event);
        break;
      case 'speaker_profiles':
        this.handlers.onSpeakerProfiles?.(event);
        this.handlers.conversation?.apply(event);
        break;
      case 'state_delta':
        this.handlers.onStateDelta?.(event);
        this.handlers.conversation?.apply(event);
        break;
      case 'turn_boundary':
        this.handlers.onTurnBoundary?.(event);
        break;
      case 'barge_in':
        this.handlers.onBargeIn?.(event);
        break;
      case 'session_end':
        this.handlers.onSessionEnd?.(event);
        this.handlers.conversation?.apply(event);
        break;
      case 'warning':
        this.handlers.onWarning?.(event);
        break;
      case 'error':
        this.handlers.onServerError?.(event);
        break;
    }
  }
}

export function realtimeWsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, '');
  if (trimmed.startsWith('wss://') || trimmed.startsWith('ws://')) {
    return `${trimmed}/v1/stream/realtime`;
  }
  if (trimmed.startsWith('https://')) {
    return `wss://${trimmed.slice('https://'.length)}/v1/stream/realtime`;
  }
  if (trimmed.startsWith('http://')) {
    return `ws://${trimmed.slice('http://'.length)}/v1/stream/realtime`;
  }
  return `wss://${trimmed}/v1/stream/realtime`;
}

function decodeSocketData(data: unknown): unknown {
  if (typeof data === 'string') return JSON.parse(data);
  if (data instanceof ArrayBuffer) {
    return JSON.parse(new TextDecoder().decode(new Uint8Array(data)));
  }
  if (ArrayBuffer.isView(data)) {
    return JSON.parse(new TextDecoder().decode(data as ArrayBufferView as Uint8Array));
  }
  // Node ws may deliver Buffer
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
    return JSON.parse(data.toString('utf8'));
  }
  throw new Error('Unsupported WebSocket message type');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
