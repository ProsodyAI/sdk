export const DEFAULT_BASE_URL = 'https://api.prosodyai.app';
export const DEFAULT_RETRY = {
    maxRetries: 2,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
};
export function resolveConfig(input) {
    if (typeof input === 'string') {
        const apiKey = input.trim();
        if (!apiKey) {
            throw new Error('ProsodyClient requires a non-empty apiKey');
        }
        return {
            apiKey,
            baseUrl: DEFAULT_BASE_URL,
            timeoutMs: 30_000,
            retry: { ...DEFAULT_RETRY },
            headers: {},
            debug: false,
        };
    }
    const apiKey = (input.apiKey ?? '').trim();
    if (!apiKey) {
        throw new Error('ProsodyClient requires a non-empty apiKey');
    }
    return {
        apiKey,
        baseUrl: input.baseUrl || DEFAULT_BASE_URL,
        timeoutMs: input.timeoutMs ?? 30_000,
        retry: { ...DEFAULT_RETRY, ...input.retry },
        headers: input.headers ?? {},
        debug: input.debug ?? false,
        onRequest: input.onRequest,
        onResponse: input.onResponse,
    };
}
