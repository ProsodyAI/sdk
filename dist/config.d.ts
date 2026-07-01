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
    timeoutMs?: number;
    retry?: Partial<RetryConfig>;
    headers?: Record<string, string>;
    debug?: boolean;
    onRequest?: (url: string, init: RequestInit) => void;
    onResponse?: (url: string, response: Response) => void;
}
export declare const DEFAULT_BASE_URL = "https://api.prosodyai.app";
export declare const DEFAULT_RETRY: RetryConfig;
export declare function resolveConfig(input: ProsodyClientConfig | string): {
    apiKey: string;
    baseUrl: string;
    timeoutMs: number;
    retry: RetryConfig;
    headers: Record<string, string>;
    debug: boolean;
    onRequest?: (url: string, init: RequestInit) => void;
    onResponse?: (url: string, response: Response) => void;
};
