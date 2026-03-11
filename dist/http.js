import { errorFromResponse, TimeoutError, ConnectionError, RateLimitError } from '@/errors';
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export async function request(method, path, opts, body, extraHeaders, signal) {
    const url = `${opts.baseUrl}${path}`;
    const headers = {
        'X-API-Key': opts.apiKey,
        ...opts.headers,
        ...extraHeaders,
    };
    const init = { method, headers, body };
    let lastError = null;
    for (let attempt = 0; attempt <= opts.retry.maxRetries; attempt++) {
        const controller = new AbortController();
        const combinedSignal = signal
            ? AbortSignal.any([signal, controller.signal])
            : controller.signal;
        const timeout = setTimeout(() => controller.abort(), opts.timeoutMs);
        try {
            if (opts.debug) {
                console.debug(`[prosody] ${method} ${url} (attempt ${attempt + 1})`);
            }
            opts.onRequest?.(url, init);
            const response = await fetch(url, { ...init, signal: combinedSignal });
            clearTimeout(timeout);
            opts.onResponse?.(url, response);
            if (response.ok)
                return response;
            const responseBody = await response.json().catch(() => ({}));
            if (!opts.retry.retryableStatuses.includes(response.status) || attempt === opts.retry.maxRetries) {
                throw errorFromResponse(response.status, responseBody);
            }
            lastError = errorFromResponse(response.status, responseBody);
            if (response.status === 429) {
                const headerMs = parseInt(response.headers.get('retry-after') || '0', 10) * 1000;
                const retryAfter = responseBody?.retry_after_ms ?? (headerMs || lastError.retryAfterMs);
                await sleep(retryAfter);
                continue;
            }
        }
        catch (err) {
            clearTimeout(timeout);
            if (err?.name === 'AbortError') {
                if (signal?.aborted)
                    throw err;
                throw new TimeoutError(`Request timed out after ${opts.timeoutMs}ms`);
            }
            if (err instanceof RateLimitError || err instanceof TimeoutError) {
                throw err;
            }
            if (err?.name === 'ProsodyError' || err?.name === 'AuthenticationError' || err?.name === 'ValidationError') {
                throw err;
            }
            if (attempt === opts.retry.maxRetries) {
                throw new ConnectionError(err?.message || 'Failed to connect');
            }
            lastError = err;
        }
        const delay = Math.min(opts.retry.initialDelayMs * Math.pow(opts.retry.backoffMultiplier, attempt), opts.retry.maxDelayMs);
        if (opts.debug) {
            console.debug(`[prosody] Retry in ${delay}ms (attempt ${attempt + 1}/${opts.retry.maxRetries + 1})`);
        }
        await sleep(delay);
    }
    throw lastError || new ConnectionError();
}
export async function requestJSON(method, path, opts, body, extraHeaders, signal) {
    const response = await request(method, path, opts, body, extraHeaders, signal);
    return response.json();
}
export async function postJSON(path, opts, payload, signal) {
    return requestJSON('POST', path, opts, JSON.stringify(payload), { 'Content-Type': 'application/json' }, signal);
}
export async function postForm(path, opts, formData, signal) {
    return requestJSON('POST', path, opts, formData, undefined, signal);
}
