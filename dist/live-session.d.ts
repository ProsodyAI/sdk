import { Conversation } from './conversation.js';
import { type RealtimeEncoding } from './realtime.js';
import { type Transcription, type TranscribeOptions } from './transcription.js';
import type { DirectiveEvent, ProsodyEvent, SessionEndEvent, SpeakerProfile } from './types.js';
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
 * Opens a direct API session, sends PCM or Opus bytes, and builds a
 * {@link Conversation} from wire events. LiveKit media uses
 * {@link ProsodyClient.livekit}.
 *
 * Apps (including the website demo) supply audio; this class owns start/stop,
 * frame pacing, and the conversation spine.
 */
export declare class LiveSession {
    private _conversation;
    private readonly options;
    private stream;
    private _sessionId;
    private _latestDirective;
    private _speakerProfiles;
    private _sessionEnd;
    private _started;
    private frameWaiters;
    private sessionEndWaiters;
    constructor(options: LiveSessionOptions);
    get conversation(): Conversation;
    get sessionId(): string | null;
    get started(): boolean;
    get latestDirective(): DirectiveEvent | null;
    get speakerProfiles(): SpeakerProfile[];
    get sessionEnd(): SessionEndEvent | null;
    get readyState(): number;
    /**
     * Open `WS /v1/stream/realtime` and send the config frame.
     * Resolves on `config_ack`.
     */
    start(overrides?: LiveSessionStartOptions): Promise<void>;
    /** Send one PCM (or Opus) audio chunk. */
    send(chunk: ArrayBuffer | Uint8Array | Buffer | Int16Array): void;
    /**
     * Wait until the server acks the current analysis second (`directive` or
     * `frame_ack`). Used for paced file replay.
     */
    waitForFrame(timeoutMs?: number): Promise<void>;
    /**
     * Ask for `session_end`, wait for it (optional), then close the socket.
     */
    stop(options?: {
        waitForSessionEndMs?: number;
    }): Promise<SessionEndEvent | null>;
    /** Immediate close without waiting for session_end. */
    close(): void;
    /** Current turns with the same optional prosody shape as batch transcription. */
    snapshot(options?: TranscribeOptions): Transcription;
    private emitUpdate;
    private releaseFrameWaiters;
    private clearFrameWaiters;
    private resolveSessionEnd;
}
