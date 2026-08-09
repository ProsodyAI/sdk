import type { AnalysisOptions, AnalysisResult, PCMOptions, FeedbackCorrectionOptions, SessionOutcomeOptions, RealtimeSessionCreateOptions, RealtimeSessionCredentials, SpeakerDirectoryResult, VoiceEnrollmentMapping, VoiceEnrollmentPreview, VoiceEnrollmentResult } from './types.js';
import type { ProsodyClientConfig } from './config.js';
import { Conversation } from './conversation.js';
import { ProsodyRealtimeStream, type ProsodyRealtimeHandlers, type RealtimeEncoding } from './realtime.js';
import { LiveSession, type LiveSessionOptions, type LiveSessionStartOptions } from './live-session.js';
import { ProsodySession, type LiveKitRoomLike, type ProsodySessionOptions } from './session.js';
import { type Transcription, type TranscribeOptions } from './transcription.js';
type RealtimeSessionOpts = LiveSessionStartOptions & Pick<LiveSessionOptions, 'onUpdate' | 'onError' | 'onClose' | 'onEvent' | 'WebSocketImpl'>;
type RealtimeConnectOpts = {
    sessionId?: string;
    encoding?: RealtimeEncoding;
    sampleRate?: number;
    container?: 'ogg' | 'webm';
    analysisMode?: string;
    source?: string;
    sourceOffsetMs?: number;
    chunkSeconds?: number;
    WebSocketImpl?: typeof WebSocket;
};
/**
 * Developer client authenticated with a `psk_*` API key.
 *
 * Three transports:
 *
 * 1. **REST**: {@link ProsodyClient.transcribe} → `POST /v1/analyze/audio`
 * 2. **Realtime WebSocket**: {@link ProsodyClient.realtime} →
 *    `WS /v1/stream/realtime` (you send PCM/Opus; events come back)
 * 3. **LiveKit**: {@link ProsodyClient.livekit} → WebRTC media plane;
 *    mint a room, consume analysis events on the data topic. Audio does not
 *    go over the Prosody WebSocket from the browser.
 *
 * The Python LiveKit plugin bridges a LiveKit track → analysis WS on the
 * agent worker. That is an agent concern, and this client leaves it there.
 */
export declare class ProsodyClient {
    private readonly opts;
    readonly apiKey: string;
    readonly baseUrl: string;
    /**
     * Analysis WebSocket transport (`WS /v1/stream/realtime`).
     */
    readonly realtime: {
        /** Session with Conversation: `start` → `send` → `stop`. */
        session: (options?: RealtimeSessionOpts) => LiveSession;
        /** Low-level stream if you want handlers without Conversation. */
        connect: (handlers?: ProsodyRealtimeHandlers, options?: RealtimeConnectOpts) => ProsodyRealtimeStream;
    };
    /**
     * LiveKit media plane (WebRTC). Audio rides LiveKit; Prosody events arrive
     * on the room data topic after a worker/plugin is analyzing the track.
     */
    readonly livekit: {
        /** Mint room credentials (`POST /v1/realtime/sessions`). Server-side only. */
        createSession: (options?: RealtimeSessionCreateOptions, signal?: AbortSignal) => Promise<RealtimeSessionCredentials>;
        /**
         * Attach to an existing LiveKit room and receive Prosody events from the
         * data channel. Does not open a Prosody WebSocket.
         */
        attach: (room: LiveKitRoomLike, options: ProsodySessionOptions) => ProsodySession;
    };
    readonly conversations: {
        analyze: (audio: string | Buffer, options?: AnalysisOptions, signal?: AbortSignal) => Promise<Conversation>;
    };
    readonly speakers: {
        list: (limit?: number, signal?: AbortSignal) => Promise<SpeakerDirectoryResult>;
        previewEnrollment: (audio: string | Buffer, signal?: AbortSignal) => Promise<VoiceEnrollmentPreview>;
        confirmEnrollment: (audio: string | Buffer, previewSha256: string, mappings: VoiceEnrollmentMapping[], signal?: AbortSignal) => Promise<VoiceEnrollmentResult>;
    };
    constructor(config: ProsodyClientConfig | string);
    /**
     * Transcribe a recording over REST. Diarization and vocal measurement are
     * options (`prosody` defaults true).
     */
    transcribe(audio: string | Buffer, options?: TranscribeOptions, signal?: AbortSignal): Promise<Transcription>;
    analyze(audio: string | Buffer, options?: AnalysisOptions, signal?: AbortSignal): Promise<AnalysisResult>;
    /** Analyze one recording into a diarized conversation with vocal measurements. */
    analyzeConversation(audio: string | Buffer, options?: AnalysisOptions, signal?: AbortSignal): Promise<Conversation>;
    analyzeBase64(base64Audio: string, options?: AnalysisOptions, signal?: AbortSignal): Promise<AnalysisResult>;
    analyzePCM(pcmData: Int16Array | Float32Array | ArrayBuffer, options?: PCMOptions, signal?: AbortSignal): Promise<AnalysisResult>;
    /** People resolved from stored speaker profiles within this API key's data scope. */
    listSpeakers(limit?: number, signal?: AbortSignal): Promise<SpeakerDirectoryResult>;
    /** Diarize an enrollment recording without persisting any identity yet. */
    previewSpeakerEnrollment(audio: string | Buffer, signal?: AbortSignal): Promise<VoiceEnrollmentPreview>;
    /** Persist an operator-confirmed mapping from every previewed lane to a person. */
    confirmSpeakerEnrollment(audio: string | Buffer, previewSha256: string, mappings: VoiceEnrollmentMapping[], signal?: AbortSignal): Promise<VoiceEnrollmentResult>;
    submitCorrection(options: FeedbackCorrectionOptions, signal?: AbortSignal): Promise<{
        status: string;
    }>;
    submitSessionOutcome(options: SessionOutcomeOptions, signal?: AbortSignal): Promise<{
        status: string;
    }>;
    health(signal?: AbortSignal): Promise<{
        status: string;
    }>;
    private openRealtimeStream;
    private openRealtimeSession;
    /**
     * Mint LiveKit room credentials for {@link ProsodyClient.livekit.createSession}.
     * Server-side only: it holds `psk_*`.
     */
    private createRealtimeSession;
}
export {};
