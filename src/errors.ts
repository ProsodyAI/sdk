export class ProsodyError extends Error {
  code?: string;
  requestId?: string;

  constructor(
    public statusCode: number,
    message: string,
    public responseBody?: unknown,
  ) {
    super(message);
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
  retryAfterMs: number;

  constructor(retryAfterMs = 1000, message = 'Rate limit exceeded') {
    super(429, message);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class ValidationError extends ProsodyError {
  constructor(message: string, public details?: Record<string, string[]>) {
    super(422, message, details);
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

function enveloped(error: ProsodyError, body: any): ProsodyError {
  const envelope = body?.error;
  if (envelope && typeof envelope === 'object') {
    if (typeof envelope.code === 'string') error.code = envelope.code;
    if (typeof envelope.request_id === 'string') error.requestId = envelope.request_id;
  }
  return error;
}

export function errorFromResponse(status: number, body: any): ProsodyError {
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
