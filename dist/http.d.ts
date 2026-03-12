import type { RetryConfig } from '@/config';
export interface RequestOptions {
    apiKey: string;
    baseUrl: string;
    modelPredictUrl?: string;
    timeoutMs: number;
    retry: RetryConfig;
    headers: Record<string, string>;
    debug: boolean;
    onRequest?: (url: string, init: RequestInit) => void;
    onResponse?: (url: string, response: Response) => void;
}
export declare function request(method: string, path: string, opts: RequestOptions, body?: BodyInit | null, extraHeaders?: Record<string, string>, signal?: AbortSignal): Promise<Response>;
export declare function requestJSON<T>(method: string, path: string, opts: RequestOptions, body?: BodyInit | null, extraHeaders?: Record<string, string>, signal?: AbortSignal): Promise<T>;
export declare function postJSON<T>(path: string, opts: RequestOptions, payload: unknown, signal?: AbortSignal): Promise<T>;
export declare function postForm<T>(path: string, opts: RequestOptions, formData: FormData, signal?: AbortSignal): Promise<T>;
