import { Conversation } from './conversation.js';
import {
  ProsodyRealtimeStream,
  type ProsodyRealtimeConfig,
  type RealtimeEncoding,
} from './realtime.js';
import {
  transcriptionFromConversation,
  type Transcription,
  type TranscribeOptions,
} from './transcription.js';
import type {
  DirectiveEvent,
  ProsodyEvent,
  SessionEndEvent,
  SpeakerProfile,
} from './types.js';

export interface LiveSessionStartOptions {
  source?: string;
  sourceOffsetMs?: number;
  sampleRate?: number;
  encoding?: RealtimeEncoding;
  container?: 'ogg' | 'webm';
  analysisMode?: string;
  chunkSeconds?: number;
  sessionId?: string;
}

export interface LiveSessionOptions {
  apiKey: string;
  baseUrl?: string;
  /** Defaults applied on {@link LiveSession.start}. */
  defaults?: LiveSessionStartOptions;
  WebSocketImpl?: typeof WebSocket;
  /** Fired after every conversation-affecting wire event. */
  onUpdate?: (session: LiveSession) => void;
  onError?: (error: Error) => void;
  onClose?: (code: number, reason: string) => void;
  /** Escape hatch for demo UI surfaces (mel, synthesis refs, …). */
  onEvent?: (event: ProsodyEvent | Record<string, unknown>) => void;
}

/**
 * Live analysis over the **Prosody WebSocket** (`WS /v1/stream/realtime`).
 *
 * This is not LiveKit and not WebRTC. You open a session, send PCM/Opus bytes,
 * and build a {@link Conversation} from wire events. Use
 * {@link ProsodyClient.livekit} when media rides a LiveKit room.
 *
 * Apps (including the website demo) supply audio; this class owns start/stop,
 * frame pacing, and the conversation spine.
 */
export class LiveSession {
  private _conversation = new Conversation();
  private readonly options: LiveSessionOptions;
  private stream: ProsodyRealtimeStream | null = null;
  private _sessionId: string | null = null;
  private _latestDirective: DirectiveEvent | null = null;
  private _speakerProfiles: SpeakerProfile[] = [];
  private _sessionEnd: SessionEndEvent | null = null;
  private _started = false;
  private frameWaiters: Array<() => void> = [];
  private sessionEndWaiters: Array<(event: SessionEndEvent | null) => void> = [];

  constructor(options: LiveSessionOptions) {
    if (!options.apiKey) throw new Error('LiveSession requires apiKey');
    this.options = options;
  }

  get conversation(): Conversation {
    return this._conversation;
  }

  get sessionId(): string | null {
    return this._sessionId;
  }

  get started(): boolean {
    return this._started;
  }

  get latestDirective(): DirectiveEvent | null {
    return this._latestDirective;
  }

  get speakerProfiles(): SpeakerProfile[] {
    return this._speakerProfiles;
  }

  get sessionEnd(): SessionEndEvent | null {
    return this._sessionEnd;
  }

  get readyState(): number {
    return this.stream?.readyState ?? WebSocket.CLOSED;
  }

  /**
   * Open `WS /v1/stream/realtime` and send the config frame.
   * Resolves on `config_ack`.
   */
  async start(overrides: LiveSessionStartOptions = {}): Promise<void> {
    if (this._started) {
      await this.stop({ waitForSessionEndMs: 0 });
    }

    this._conversation = new Conversation();
    const conversation = this._conversation;
    const defaults = this.options.defaults ?? {};
    const startOpts: LiveSessionStartOptions = { ...defaults, ...overrides };

    this._sessionId = null;
    this._latestDirective = null;
    this._speakerProfiles = [];
    this._sessionEnd = null;
    this.clearFrameWaiters();

    const config: ProsodyRealtimeConfig = {
      apiKey: this.options.apiKey,
      baseUrl: this.options.baseUrl,
      sessionId: startOpts.sessionId,
      encoding: startOpts.encoding ?? 'pcm16',
      sampleRate: startOpts.sampleRate ?? 16_000,
      container: startOpts.container,
      analysisMode: startOpts.analysisMode,
      source: startOpts.source ?? 'sdk',
      sourceOffsetMs: startOpts.sourceOffsetMs,
      chunkSeconds: startOpts.chunkSeconds ?? 1,
      WebSocketImpl: this.options.WebSocketImpl,
    };

    const stream = new ProsodyRealtimeStream(config, {
      conversation,
      onConfigAck: (event) => {
        const id = typeof event.session_id === 'string' ? event.session_id : null;
        this._sessionId = id;
        this.emitUpdate();
      },
      onDirective: (event) => {
        this._latestDirective = event;
        this.releaseFrameWaiters();
        this.emitUpdate();
      },
      onFrameAck: () => {
        this.releaseFrameWaiters();
      },
      onTranscriptUpdate: () => this.emitUpdate(),
      onSpeakerUpdate: () => this.emitUpdate(),
      onSpeakerClusterUpdate: () => this.emitUpdate(),
      onSpeakerProfiles: (event) => {
        if (event.profiles?.length) this._speakerProfiles = event.profiles;
        this.emitUpdate();
      },
      onSessionEnd: (event) => {
        this._sessionEnd = event;
        conversation.apply(event);
        this.resolveSessionEnd(event);
        this.emitUpdate();
      },
      onEvent: (event) => {
        this.options.onEvent?.(event);
      },
      onError: (error) => {
        this.options.onError?.(error);
      },
      onClose: (code, reason) => {
        this._started = false;
        this.releaseFrameWaiters();
        this.resolveSessionEnd(this._sessionEnd);
        this.options.onClose?.(code, reason);
        this.emitUpdate();
      },
      onServerError: (event) => {
        this.options.onError?.(new Error(event.message || 'Realtime stream error'));
      },
    });

    this.stream = stream;
    await stream.connect();
    this._started = true;
    this.emitUpdate();
  }

  /** Send one PCM (or Opus) audio chunk. */
  send(chunk: ArrayBuffer | Uint8Array | Buffer | Int16Array): void {
    if (!this.stream) throw new Error('LiveSession is not started');
    if (chunk instanceof Int16Array) {
      const view = new Uint8Array(
        chunk.buffer,
        chunk.byteOffset,
        chunk.byteLength,
      );
      this.stream.sendAudio(view);
      return;
    }
    this.stream.sendAudio(chunk);
  }

  /**
   * Wait until the server acks the current analysis second (`directive` or
   * `frame_ack`). Used for paced file replay.
   */
  waitForFrame(timeoutMs = 10_000): Promise<void> {
    if (!this._started) {
      return Promise.reject(new Error('LiveSession is not started'));
    }
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | 0 = 0;
      const release = () => {
        if (timer) clearTimeout(timer);
        resolve();
      };
      timer = setTimeout(() => {
        this.frameWaiters = this.frameWaiters.filter((item) => item !== release);
        reject(new Error('Live analysis timed out'));
      }, timeoutMs);
      this.frameWaiters.push(release);
    });
  }

  /**
   * Ask for `session_end`, wait for it (optional), then close the socket.
   */
  async stop(options: { waitForSessionEndMs?: number } = {}): Promise<SessionEndEvent | null> {
    const waitMs = options.waitForSessionEndMs ?? 20_000;
    const stream = this.stream;
    if (!stream) {
      this._started = false;
      return this._sessionEnd;
    }

    let endEvent: SessionEndEvent | null = this._sessionEnd;
    if (stream.readyState === WebSocket.OPEN) {
      const endPromise = new Promise<SessionEndEvent | null>((resolve) => {
        if (waitMs <= 0) {
          resolve(this._sessionEnd);
          return;
        }
        const timer = setTimeout(() => {
          this.sessionEndWaiters = this.sessionEndWaiters.filter((w) => w !== onEnd);
          resolve(this._sessionEnd);
        }, waitMs);
        const onEnd = (event: SessionEndEvent | null) => {
          clearTimeout(timer);
          resolve(event);
        };
        this.sessionEndWaiters.push(onEnd);
      });
      stream.end();
      endEvent = await endPromise;
    }

    stream.close();
    this.stream = null;
    this._started = false;
    this.clearFrameWaiters();
    this.emitUpdate();
    return endEvent;
  }

  /** Immediate close without waiting for session_end. */
  close(): void {
    this.stream?.close();
    this.stream = null;
    this._started = false;
    this.clearFrameWaiters();
    this.resolveSessionEnd(this._sessionEnd);
    this.emitUpdate();
  }

  /** Current turns with optional `prosody` — same shape as batch `transcribe`. */
  snapshot(options?: TranscribeOptions): Transcription {
    return transcriptionFromConversation(this._conversation, options);
  }

  private emitUpdate(): void {
    this.options.onUpdate?.(this);
  }

  private releaseFrameWaiters(): void {
    const waiters = this.frameWaiters;
    this.frameWaiters = [];
    for (const release of waiters) release();
  }

  private clearFrameWaiters(): void {
    this.frameWaiters = [];
  }

  private resolveSessionEnd(event: SessionEndEvent | null): void {
    const waiters = this.sessionEndWaiters;
    this.sessionEndWaiters = [];
    for (const resolve of waiters) resolve(event);
  }
}
