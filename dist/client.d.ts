import type { AnalysisOptions, AnalysisResult, PCMOptions, StreamingOptions, FeedbackCorrectionOptions, FeedbackOutcomeOptions, SessionOutcomeOptions, FineTuneConfig, FineTuneJob, FineTuneSample } from '@/types';
import type { ProsodyClientConfig } from '@/config';
import { ProsodyStream } from '@/stream';
import { ProsodyRealtimeStream } from '@/realtime';
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
    createFineTune(config: FineTuneConfig, signal?: AbortSignal): Promise<FineTuneJob>;
    uploadFineTuneSamples(jobId: string, samples: FineTuneSample[], signal?: AbortSignal): Promise<{
        uploaded: number;
    }>;
    startFineTune(jobId: string, signal?: AbortSignal): Promise<FineTuneJob>;
    getFineTune(jobId: string, signal?: AbortSignal): Promise<FineTuneJob>;
    listFineTunes(signal?: AbortSignal): Promise<FineTuneJob[]>;
    createStream(options?: StreamingOptions): ProsodyStream;
    createRealtimeStream(options?: StreamingOptions): ProsodyRealtimeStream;
}
