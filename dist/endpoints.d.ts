import type { RequestOptions } from './http.js';
import type { RealtimeSessionCredentials, SpeakerDirectoryResult, VoiceEnrollmentPreview, VoiceEnrollmentResult } from './types.js';
/**
 * One REST endpoint: method, path, and response type. The response type rides
 * along as a phantom so call sites stay typed from the table alone.
 */
export interface Endpoint<Response> {
    readonly method: 'GET' | 'POST';
    readonly path: string;
    readonly response?: Response;
}
/** The whole REST surface. Adding an endpoint is one entry here. */
export declare const endpoints: {
    readonly analyzeAudio: Endpoint<Record<string, unknown>>;
    readonly analyzeBase64: Endpoint<Record<string, unknown>>;
    readonly submitCorrection: Endpoint<{
        status: string;
    }>;
    readonly submitSessionOutcome: Endpoint<{
        status: string;
    }>;
    readonly listSpeakers: Endpoint<SpeakerDirectoryResult>;
    readonly previewEnrollment: Endpoint<VoiceEnrollmentPreview>;
    readonly confirmEnrollment: Endpoint<VoiceEnrollmentResult>;
    readonly createRealtimeSession: Endpoint<RealtimeSessionCredentials>;
    readonly health: Endpoint<{
        status: string;
    }>;
};
export declare function callJSON<Response>(target: Endpoint<Response>, opts: RequestOptions, payload: unknown, signal?: AbortSignal): Promise<Response>;
export declare function callForm<Response>(target: Endpoint<Response>, opts: RequestOptions, formData: FormData, signal?: AbortSignal): Promise<Response>;
export declare function callQuery<Response>(target: Endpoint<Response>, opts: RequestOptions, query?: Record<string, string | number>, signal?: AbortSignal): Promise<Response>;
