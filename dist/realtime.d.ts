import type { DirectiveEvent, ProsodyEvent, ServerErrorEvent, SessionEndEvent, SpeakerClusterUpdateEvent, SpeakerProfilesEvent, SpeakerUpdateEvent, TranscriptUpdateEvent, WarningEvent, AgentSteeringEvent, InsightsUpdateEvent } from './types.js';
import { AcousticWindow } from './step.js';
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
    maxSpeakers?: number;
    analysisMode?: string;
    source?: string;
    /** WebSocket constructor. Inject in tests; defaults to global WebSocket. */
    WebSocketImpl?: typeof WebSocket;
}
export interface ProsodyRealtimeHandlers {
    onConfigAck?: (event: Record<string, unknown>) => void;
    onDirective?: (event: DirectiveEvent) => void;
    onAcousticWindow?: (window: AcousticWindow) => void;
    /** @deprecated Use onAcousticWindow. */
    onRecurrentStep?: (step: AcousticWindow) => void;
    conversation?: Conversation;
    onTranscriptUpdate?: (event: TranscriptUpdateEvent) => void;
    onSpeakerUpdate?: (event: SpeakerUpdateEvent) => void;
    onSpeakerClusterUpdate?: (event: SpeakerClusterUpdateEvent) => void;
    onSpeakerProfiles?: (event: SpeakerProfilesEvent) => void;
    onSteering?: (event: AgentSteeringEvent) => void;
    onInsightsUpdate?: (event: InsightsUpdateEvent) => void;
    onSessionEnd?: (event: SessionEndEvent) => void;
    onWarning?: (event: WarningEvent) => void;
    onServerError?: (event: ServerErrorEvent) => void;
    onEvent?: (event: ProsodyEvent | Record<string, unknown>) => void;
    onError?: (error: Error) => void;
    onClose?: (code: number, reason: string) => void;
}
/**
 * Lower-level live analysis client for `WS /v1/stream/realtime`.
 *
 * Holds a developer `psk_*` key. Use it from a trusted server or Node worker,
 * not from an untrusted browser page. Browser LiveKit clients should mint a
 * room and consume republished events with `ProsodySession` instead.
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
    close(code?: number, reason?: string): void;
    private buildConfig;
    private dispatch;
}
export declare function realtimeWsUrl(baseUrl: string): string;
