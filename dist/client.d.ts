import type { AnalysisOptions, AnalysisResult, PCMOptions, FeedbackCorrectionOptions, FeedbackOutcomeOptions, SessionOutcomeOptions, RealtimeSessionCreateOptions, RealtimeSessionCredentials, SpeakerDirectoryResult, VoiceEnrollmentMapping, VoiceEnrollmentPreview, VoiceEnrollmentResult } from './types.js';
import type { ProsodyClientConfig } from './config.js';
import { Conversation } from './conversation.js';
import { ProsodyRealtimeStream, type ProsodyRealtimeHandlers, type RealtimeEncoding } from './realtime.js';
/**
 * Organization data-plane client (`psk_*`).
 *
 * Public verbs map to authenticated Prosody API routes. Request-scoped
 * conversation analysis and persistent speaker identity are exposed as
 * separate developer resources. The API key owns tenant scope and access.
 */
export declare class ProsodyClient {
    private readonly opts;
    readonly apiKey: string;
    readonly baseUrl: string;
    readonly conversations: {
        analyze: (audio: string | Buffer, options?: AnalysisOptions, signal?: AbortSignal) => Promise<Conversation>;
    };
    readonly speakers: {
        list: (limit?: number, signal?: AbortSignal) => Promise<SpeakerDirectoryResult>;
        previewEnrollment: (audio: string | Buffer, signal?: AbortSignal) => Promise<VoiceEnrollmentPreview>;
        confirmEnrollment: (audio: string | Buffer, previewSha256: string, mappings: VoiceEnrollmentMapping[], signal?: AbortSignal) => Promise<VoiceEnrollmentResult>;
    };
    constructor(config: ProsodyClientConfig | string);
    analyze(audio: string | Buffer, options?: AnalysisOptions, signal?: AbortSignal): Promise<AnalysisResult>;
    /** Analyze one recording into a diarized conversation with vocal measurements. */
    analyzeConversation(audio: string | Buffer, options?: AnalysisOptions, signal?: AbortSignal): Promise<Conversation>;
    analyzeBase64(base64Audio: string, options?: AnalysisOptions, signal?: AbortSignal): Promise<AnalysisResult>;
    analyzePCM(pcmData: Int16Array | Float32Array | ArrayBuffer, options?: PCMOptions, signal?: AbortSignal): Promise<AnalysisResult>;
    /** People this organization has resolved from stored acoustic speaker profiles. */
    listSpeakers(limit?: number, signal?: AbortSignal): Promise<SpeakerDirectoryResult>;
    /** Diarize an enrollment recording without persisting any identity yet. */
    previewSpeakerEnrollment(audio: string | Buffer, signal?: AbortSignal): Promise<VoiceEnrollmentPreview>;
    /** Persist an operator-confirmed mapping from every previewed lane to a person. */
    confirmSpeakerEnrollment(audio: string | Buffer, previewSha256: string, mappings: VoiceEnrollmentMapping[], signal?: AbortSignal): Promise<VoiceEnrollmentResult>;
    extractFeatures(audio: string | Buffer, signal?: AbortSignal): Promise<Record<string, number>>;
    submitCorrection(options: FeedbackCorrectionOptions, signal?: AbortSignal): Promise<{
        status: string;
    }>;
    submitOutcome(options: FeedbackOutcomeOptions, signal?: AbortSignal): Promise<{
        status: string;
    }>;
    submitSessionOutcome(options: SessionOutcomeOptions, signal?: AbortSignal): Promise<{
        status: string;
    }>;
    /**
     * Open `WS /v1/stream/realtime` with this org key.
     * Trusted server / worker only — do not put `psk_*` in the browser.
     */
    realtime(handlers?: ProsodyRealtimeHandlers, options?: {
        sessionId?: string;
        encoding?: RealtimeEncoding;
        sampleRate?: number;
        container?: 'ogg' | 'webm';
        maxSpeakers?: number;
        analysisMode?: string;
        source?: string;
        WebSocketImpl?: typeof WebSocket;
    }): ProsodyRealtimeStream;
    /**
     * Mint one LiveKit room (media plane). Analysis still runs on the WebSocket
     * inside the Prosody worker. Call from a trusted server only.
     */
    createRealtimeSession(options?: RealtimeSessionCreateOptions, signal?: AbortSignal): Promise<RealtimeSessionCredentials>;
    health(signal?: AbortSignal): Promise<{
        status: string;
    }>;
}
