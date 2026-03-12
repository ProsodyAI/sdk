export interface RetryConfig {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
    retryableStatuses: number[];
}
export interface ProsodyClientConfig {
    apiKey: string;
    baseUrl?: string;
    /** When set, analyze/analyzeBase64/analyzePCM call this model predict URL with Api-Key auth and { audio_base64 } body. */
    modelPredictUrl?: string;
    timeoutMs?: number;
    retry?: Partial<RetryConfig>;
    headers?: Record<string, string>;
    debug?: boolean;
    onRequest?: (url: string, init: RequestInit) => void;
    onResponse?: (url: string, response: Response) => void;
}
export declare const DEFAULT_BASE_URL = "https://api.prosody.ai";
export declare const DEFAULT_RETRY: RetryConfig;
export declare function resolveConfig(input: ProsodyClientConfig | string): {
    apiKey: string;
    baseUrl: string;
    modelPredictUrl?: string;
    timeoutMs: number;
    retry: RetryConfig;
    headers: Record<string, string>;
    debug: boolean;
    onRequest?: (url: string, init: RequestInit) => void;
    onResponse?: (url: string, response: Response) => void;
};
