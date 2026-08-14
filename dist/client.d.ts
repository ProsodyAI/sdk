import type { AnalysisEvent, AnalysisOptions, AnalysisResult, DiarizedSpeaker, PCMOptions, TurnBoundary, FeedbackCorrectionOptions, SessionOutcomeOptions, RealtimeSessionCreateOptions, RealtimeSessionCredentials, SpeakerDirectoryResult, VoiceEnrollmentMapping, VoiceEnrollmentPreview, VoiceEnrollmentResult } from './types.js';
import type { ProsodyClientConfig } from './config.js';
import type { RecallResult } from './types/memory.js';
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
 * Three modes, named after the API's own prefixes:
 *
 * 1. **analyze**: REST batch, {@link ProsodyClient.transcribe} →
 *    `POST /v1/analyze/audio`
 * 2. **stream**: {@link ProsodyClient.stream} → `WS /v1/stream/realtime`
 *    (you send PCM/Opus; events come back)
 * 3. **realtime**: {@link ProsodyClient.realtime} → the LiveKit WebRTC
 *    media plane; mint a room, consume analysis events on the data topic.
 *    Audio does not go over the Prosody WebSocket from the browser.
 *
 * The Python LiveKit plugin bridges a LiveKit track → analysis WS on the
 * agent worker. That is an agent concern, and this client leaves it there.
 */
export declare class ProsodyClient {
    private readonly opts;
    readonly apiKey: string;
    readonly baseUrl: string;
    /**
     * The analysis WebSocket transport (`WS /v1/stream/realtime`).
     */
    readonly stream: {
        /** Session with Conversation: `start` → `send` → `stop`. */
        session: (options?: RealtimeSessionOpts) => LiveSession;
        /** Low-level stream if you want handlers without Conversation. */
        connect: (handlers?: ProsodyRealtimeHandlers, options?: RealtimeConnectOpts) => ProsodyRealtimeStream;
    };
    /**
     * The LiveKit media plane (WebRTC). Audio rides LiveKit; Prosody events
     * arrive on the room data topic after a worker/plugin is analyzing the
     * track.
     */
    readonly realtime: {
        /** Mint room credentials (`POST /v1/realtime/sessions`). Server-side only. */
        createSession: (options?: RealtimeSessionCreateOptions, signal?: AbortSignal) => Promise<RealtimeSessionCredentials>;
        /**
         * Attach to an existing LiveKit room and receive Prosody events from the
         * data channel. Does not open a Prosody WebSocket.
         */
        attach: (room: LiveKitRoomLike, options: ProsodySessionOptions) => ProsodySession;
    };
    /**
     * The batch analysis namespace. {@link ProsodyClient.conversations.analyze}
     * returns a `Conversation` (turns, speakers, frames, deltas).
     */
    readonly conversations: {
        /** Analyze one recording into a diarized conversation with vocal measurements. */
        analyze: (audio: string | Buffer, options?: AnalysisOptions, signal?: AbortSignal) => Promise<Conversation>;
    };
    /**
     * Speaker identity: list resolved people, and enroll new voices in a
     * two-step preview-then-confirm flow.
     */
    readonly speakers: {
        /** People resolved from stored speaker profiles within this API key's data scope. */
        list: (limit?: number, signal?: AbortSignal) => Promise<SpeakerDirectoryResult>;
        /** Diarize an enrollment recording without persisting any identity yet. */
        previewEnrollment: (audio: string | Buffer, signal?: AbortSignal) => Promise<VoiceEnrollmentPreview>;
        /** Persist an operator-confirmed mapping from every previewed lane to a person. */
        confirmEnrollment: (audio: string | Buffer, previewSha256: string, mappings: VoiceEnrollmentMapping[], signal?: AbortSignal) => Promise<VoiceEnrollmentResult>;
    };
    /**
     * Operator surface: a saved person's persisted significant moments.
     * Shipped for internal tooling and absent from the published docs.
     */
    readonly memory: {
        recall: {
            /** `POST /v1/memory/recall`: `memory.recall.post(personId, topK)`. */
            post: (personId: string, topK?: number, signal?: AbortSignal) => Promise<RecallResult>;
        };
    };
    constructor(config: ProsodyClientConfig | string);
    /**
     * Transcribe a recording over REST. Diarization and vocal measurement are
     * options (`prosody` defaults true).
     */
    transcribe(audio: string | Buffer, options?: TranscribeOptions, signal?: AbortSignal): Promise<Transcription>;
    /**
     * Raw batch analysis result (`POST /v1/analyze/audio`). Returns the parsed
     * `AnalysisResult` directly; prefer {@link ProsodyClient.transcribe} or
     * {@link ProsodyClient.analyzeConversation} for typed readouts.
     */
    analyze(audio: string | Buffer, options?: AnalysisOptions, signal?: AbortSignal): Promise<AnalysisResult>;
    /** Analyze one recording into a diarized conversation with vocal measurements. */
    analyzeConversation(audio: string | Buffer, options?: AnalysisOptions, signal?: AbortSignal): Promise<Conversation>;
    /** Diarized turns with text: who said what, and when. */
    getTurns(audio: string | Buffer, options?: AnalysisOptions, signal?: AbortSignal): Promise<import("./conversation.js").ConversationTurn[]>;
    /**
     * The timing skeleton of the conversation: one `{speaker_id, start_ms,
     * end_ms}` per turn on the model's 80ms frame clock. Carries no text.
     */
    getTurnBoundaries(audio: string | Buffer, options?: AnalysisOptions, signal?: AbortSignal): Promise<TurnBoundary[]>;
    /**
     * The committed conversation events in commit order: turn boundaries,
     * barge-ins, and state deltas, each with its retrodictive `frame_ms` on the
     * 80ms frame clock.
     */
    getEvents(audio: string | Buffer, options?: AnalysisOptions, signal?: AbortSignal): Promise<AnalysisEvent[]>;
    /** The recording-local speakers with talk time and turn counts. */
    getSpeakers(audio: string | Buffer, options?: AnalysisOptions, signal?: AbortSignal): Promise<DiarizedSpeaker[]>;
    /** Analyze base64-encoded audio over the JSON endpoint. */
    analyzeBase64(base64Audio: string, options?: AnalysisOptions, signal?: AbortSignal): Promise<AnalysisResult>;
    /** Analyze raw PCM (Int16/Float32/ArrayBuffer) by wrapping it as WAV first. */
    analyzePCM(pcmData: Int16Array | Float32Array | ArrayBuffer, options?: PCMOptions, signal?: AbortSignal): Promise<AnalysisResult>;
    /** People resolved from stored speaker profiles within this API key's data scope. */
    listSpeakers(limit?: number, signal?: AbortSignal): Promise<SpeakerDirectoryResult>;
    /** Diarize an enrollment recording without persisting any identity yet. */
    previewSpeakerEnrollment(audio: string | Buffer, signal?: AbortSignal): Promise<VoiceEnrollmentPreview>;
    /** Persist an operator-confirmed mapping from every previewed lane to a person. */
    confirmSpeakerEnrollment(audio: string | Buffer, previewSha256: string, mappings: VoiceEnrollmentMapping[], signal?: AbortSignal): Promise<VoiceEnrollmentResult>;
    /**
     * A saved person's top-K significant moments, recency-ranked: the call
     * carries no ranking vector, so the route's recency mode answers.
     */
    private recallMemory;
    /** Submit a corrected V/A/D reading for a prediction, for model feedback. */
    submitCorrection(options: FeedbackCorrectionOptions, signal?: AbortSignal): Promise<{
        status: string;
    }>;
    /** Submit per-session KPI outcomes for a call, for outcome labeling. */
    submitSessionOutcome(options: SessionOutcomeOptions, signal?: AbortSignal): Promise<{
        status: string;
    }>;
    /** Service health check (`GET /v1/health`). */
    health(signal?: AbortSignal): Promise<{
        status: string;
    }>;
    private openRealtimeStream;
    private openRealtimeSession;
    /**
     * Mint LiveKit room credentials for {@link ProsodyClient.realtime.createSession}.
     * Server-side only: it holds `psk_*`.
     */
    private createRealtimeSession;
}
export {};
