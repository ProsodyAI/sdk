import type { AnalysisOptions, AnalysisResult, PCMOptions, FeedbackCorrectionOptions, FeedbackOutcomeOptions, SessionOutcomeOptions } from './types.js';
import type { ProsodyClientConfig } from './config.js';
export declare class ProsodyClient {
    private readonly opts;
    readonly apiKey: string;
    readonly baseUrl: string;
    constructor(config: ProsodyClientConfig | string);
    analyze(audio: string | Buffer, options?: AnalysisOptions, signal?: AbortSignal): Promise<AnalysisResult>;
    analyzeBase64(base64Audio: string, options?: AnalysisOptions, signal?: AbortSignal): Promise<AnalysisResult>;
    analyzePCM(pcmData: Int16Array | Float32Array | ArrayBuffer, options?: PCMOptions, signal?: AbortSignal): Promise<AnalysisResult>;
    extractFeatures(audio: string | Buffer, signal?: AbortSignal): Promise<Record<string, number>>;
    health(signal?: AbortSignal): Promise<{
        status: string;
    }>;
    submitCorrection(options: FeedbackCorrectionOptions, signal?: AbortSignal): Promise<{
        status: string;
    }>;
    submitOutcome(options: FeedbackOutcomeOptions, signal?: AbortSignal): Promise<{
        status: string;
    }>;
    submitSessionOutcome(options: SessionOutcomeOptions, signal?: AbortSignal): Promise<{
        status: string;
    }>;
}
