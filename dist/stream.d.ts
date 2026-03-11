import type { AnalysisResult, StreamingOptions } from '@/types';
import type { ProsodyClient } from '@/client';
export declare class ProsodyStream {
    private client;
    private options;
    private buffer;
    private sampleCount;
    private samplesPerChunk;
    private processing;
    constructor(client: ProsodyClient, options?: StreamingOptions);
    push(samples: Float32Array | Int16Array): void;
    flush(): Promise<AnalysisResult | null>;
    clear(): void;
    private processChunk;
}
