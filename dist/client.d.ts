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
 * Developer client authenticated with a `psk_*` API key. Three modes:
 * {@link ProsodyClient.transcribe} for REST batch analysis,
 * {@link ProsodyClient.stream} for the analysis WebSocket, and
 * {@link ProsodyClient.realtime} for the LiveKit media plane.
 */
export declare class ProsodyClient {
    private readonly opts;
    readonly apiKey: string;
    readonly baseUrl: string;
    /** The analysis WebSocket transport (`WS /v1/stream/realtime`). */
    readonly stream: {
        /** Session with Conversation: `start` → `send` → `stop`. */
        session: (options?: RealtimeSessionOpts) => LiveSession;
        /** Low-level stream if you want handlers without Conversation. */
        connect: (handlers?: ProsodyRealtimeHandlers, options?: RealtimeConnectOpts) => ProsodyRealtimeStream;
    };
    /** The LiveKit media plane: audio rides LiveKit; events arrive on the room data topic. */
    readonly realtime: {
        /** Mint room credentials (`POST /v1/realtime/sessions`). Server-side only. */
        createSession: (options?: RealtimeSessionCreateOptions, signal?: AbortSignal) => Promise<RealtimeSessionCredentials>;
        /** Attach to an existing LiveKit room and receive Prosody events from the data channel. */
        attach: (room: LiveKitRoomLike, options: ProsodySessionOptions) => ProsodySession;
    };
    /** Batch analysis: analyze one recording into a `Conversation`. */
    readonly conversations: {
        /** Analyze one recording into a diarized conversation with vocal measurements. */
        analyze: (audio: string | Buffer, options?: AnalysisOptions, signal?: AbortSignal) => Promise<Conversation>;
    };
    /** Speaker identity: list resolved people and enroll voices (preview, then confirm). */
    readonly speakers: {
        /** People resolved from stored speaker profiles within this API key's data scope. */
        list: (limit?: number, signal?: AbortSignal) => Promise<SpeakerDirectoryResult>;
        /** Diarize an enrollment recording without persisting any identity yet. */
        previewEnrollment: (audio: string | Buffer, signal?: AbortSignal) => Promise<VoiceEnrollmentPreview>;
        /** Persist an operator-confirmed mapping from every previewed lane to a person. */
        confirmEnrollment: (audio: string | Buffer, previewSha256: string, mappings: VoiceEnrollmentMapping[], signal?: AbortSignal) => Promise<VoiceEnrollmentResult>;
    };
    /** Operator surface: a saved person's persisted significant moments. */
    readonly memory: {
        recall: {
            /** `POST /v1/memory/recall`: `memory.recall.post(personId, topK)`. */
            post: (personId: string, topK?: number, signal?: AbortSignal) => Promise<RecallResult>;
        };
    };
    constructor(config: ProsodyClientConfig | string);
    /** Transcribe a recording over REST; diarization and vocal measurement are options. */
    transcribe(audio: string | Buffer, options?: TranscribeOptions, signal?: AbortSignal): Promise<Transcription>;
    /** Raw batch analysis result (`POST /v1/analyze/audio`), parsed as `AnalysisResult`. */
    analyze(audio: string | Buffer, options?: AnalysisOptions, signal?: AbortSignal): Promise<AnalysisResult>;
    /** Analyze one recording into a diarized conversation with vocal measurements. */
    analyzeConversation(audio: string | Buffer, options?: AnalysisOptions, signal?: AbortSignal): Promise<Conversation>;
    /** Diarized turns with text: who said what, and when. */
    getTurns(audio: string | Buffer, options?: AnalysisOptions, signal?: AbortSignal): Promise<import("./conversation.js").ConversationTurn[]>;
    /** Turn timing on the model's 80ms frame clock: `{speaker_id, start_ms, end_ms}`, no text. */
    getTurnBoundaries(audio: string | Buffer, options?: AnalysisOptions, signal?: AbortSignal): Promise<TurnBoundary[]>;
    /** Committed conversation events in commit order, each with its retrodictive `frame_ms`. */
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
    /** A saved person's top-K significant moments, recency-ranked. */
    private recallMemory;
    /** Submit corrected emotional attributes (valence, arousal, dominance) for a prediction, for model feedback. */
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
    /** Mint LiveKit room credentials. Server-side only: it holds `psk_*`. */
    private createRealtimeSession;
}
export {};
