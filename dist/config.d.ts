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
    /** When set, analyze/analyzeBase64/analyzePCM call this Baseten predict URL with Api-Key auth and { audio_base64 } body. Example: https://model-31ddmz13.api.baseten.co/environments/production/predict */
    basetenPredictUrl?: string;
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
    basetenPredictUrl?: string;
    timeoutMs: number;
    retry: RetryConfig;
    headers: Record<string, string>;
    debug: boolean;
    onRequest?: (url: string, init: RequestInit) => void;
    onResponse?: (url: string, response: Response) => void;
};
