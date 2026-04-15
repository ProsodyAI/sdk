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

export const DEFAULT_BASE_URL = 'https://api.prosodyai.app';

export const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 2,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

export function resolveConfig(input: ProsodyClientConfig | string): {
  apiKey: string;
  baseUrl: string;
  modelPredictUrl?: string;
  timeoutMs: number;
  retry: RetryConfig;
  headers: Record<string, string>;
  debug: boolean;
  onRequest?: (url: string, init: RequestInit) => void;
  onResponse?: (url: string, response: Response) => void;
} {
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
    modelPredictUrl: input.modelPredictUrl,
    timeoutMs: input.timeoutMs ?? 30_000,
    retry: { ...DEFAULT_RETRY, ...input.retry },
    headers: input.headers ?? {},
    debug: input.debug ?? false,
    onRequest: input.onRequest,
    onResponse: input.onResponse,
  };
}
