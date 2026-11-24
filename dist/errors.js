export class ProsodyError extends Error {
    statusCode;
    responseBody;
    code;
    requestId;
    constructor(statusCode, message, responseBody) {
        super(message);
        this.statusCode = statusCode;
        this.responseBody = responseBody;
        this.name = 'ProsodyError';
    }
}
export class AuthenticationError extends ProsodyError {
    constructor(message = 'Invalid or missing API key') {
        super(401, message);
        this.name = 'AuthenticationError';
    }
}
export class RateLimitError extends ProsodyError {
    retryAfterMs;
    constructor(retryAfterMs = 1000, message = 'Rate limit exceeded') {
        super(429, message);
        this.name = 'RateLimitError';
        this.retryAfterMs = retryAfterMs;
    }
}
export class ValidationError extends ProsodyError {
    details;
    constructor(message, details) {
        super(422, message, details);
        this.details = details;
        this.name = 'ValidationError';
    }
}
export class TimeoutError extends ProsodyError {
    constructor(message = 'Request timed out') {
        super(0, message);
        this.name = 'TimeoutError';
    }
}
export class ConnectionError extends ProsodyError {
    constructor(message = 'Failed to connect') {
        super(0, message);
        this.name = 'ConnectionError';
    }
}
function enveloped(error, body) {
    const envelope = body?.error;
    if (envelope && typeof envelope === 'object') {
        if (typeof envelope.code === 'string')
            error.code = envelope.code;
        if (typeof envelope.request_id === 'string')
            error.requestId = envelope.request_id;
    }
    return error;
}
export function errorFromResponse(status, body) {
    const described = body?.error && typeof body.error === 'object' ? body.error.message : undefined;
    const message = body?.message || described || body?.error || `Request failed with status ${status}`;
    switch (status) {
        case 401:
        case 403:
            return enveloped(new AuthenticationError(message), body);
        case 422:
            return enveloped(new ValidationError(message, body?.details), body);
        case 429: {
            const retryAfter = body?.retry_after_ms ?? 1000;
            return enveloped(new RateLimitError(retryAfter, message), body);
        }
        default:
            return enveloped(new ProsodyError(status, message, body), body);
    }
}
