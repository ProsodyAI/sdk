import type { BargeInEvent, DirectiveEvent, ProsodyEvent, ServerErrorEvent, SessionEndEvent, SpeakerProfilesEvent, SpeakerUpdateEvent, StateDeltaEvent, TranscriptUpdateEvent, TurnBoundaryEvent, WarningEvent } from './types.js';
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
export declare class ProsodyRealtimeStream {
    private readonly config;
    private readonly handlers;
    private socket;
    private opened;
    private closed;
    constructor(config: ProsodyRealtimeConfig, handlers?: ProsodyRealtimeHandlers);
    get sessionId(): string | undefined;
    get readyState(): number;
    /** Open the socket and send the config frame. Resolves on `config_ack`. */
    connect(): Promise<Record<string, unknown>>;
    /** Send mono PCM16 (or Opus container) audio bytes. */
    sendAudio(chunk: ArrayBuffer | Uint8Array | Buffer): void;
    /** Ask the server for `session_end` and close after. */
    end(): void;
    /** Send one JSON control frame as a text message (e.g. `voice_profile_update`). */
    sendControl(message: Record<string, unknown>): void;
    close(code?: number, reason?: string): void;
    private buildConfig;
    private dispatch;
}
export declare function realtimeWsUrl(baseUrl: string): string;
