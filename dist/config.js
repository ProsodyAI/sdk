export const DEFAULT_BASE_URL = 'https://api.prosody.ai';
export const DEFAULT_RETRY = {
    maxRetries: 2,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
};
export function resolveConfig(input) {
    if (typeof input === 'string') {
        return {
            apiKey: input,
            baseUrl: DEFAULT_BASE_URL,
            timeoutMs: 30_000,
            retry: { ...DEFAULT_RETRY },
            headers: {},
            debug: false,
        };
    }
    return {
        apiKey: input.apiKey,
        baseUrl: input.baseUrl || DEFAULT_BASE_URL,
        basetenPredictUrl: input.basetenPredictUrl,
        timeoutMs: input.timeoutMs ?? 30_000,
        retry: { ...DEFAULT_RETRY, ...input.retry },
        headers: input.headers ?? {},
        debug: input.debug ?? false,
        onRequest: input.onRequest,
        onResponse: input.onResponse,
    };
}
