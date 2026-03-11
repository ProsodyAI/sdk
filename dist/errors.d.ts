export declare class ProsodyError extends Error {
    statusCode: number;
    responseBody?: unknown | undefined;
    constructor(statusCode: number, message: string, responseBody?: unknown | undefined);
}
export declare class AuthenticationError extends ProsodyError {
    constructor(message?: string);
}
export declare class RateLimitError extends ProsodyError {
    retryAfterMs: number;
    constructor(retryAfterMs?: number, message?: string);
}
export declare class ValidationError extends ProsodyError {
    details?: Record<string, string[]> | undefined;
    constructor(message: string, details?: Record<string, string[]> | undefined);
}
export declare class TimeoutError extends ProsodyError {
    constructor(message?: string);
}
export declare class ConnectionError extends ProsodyError {
    constructor(message?: string);
}
export declare function errorFromResponse(status: number, body: any): ProsodyError;
