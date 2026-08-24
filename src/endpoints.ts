import type { RequestOptions } from './http.js';
import { postForm, postJSON, requestJSON } from './http.js';
import type { RecallResult } from './types/memory.js';
import type { IpaTranscription } from './types/phonetics.js';
import type {
  RealtimeSessionCredentials,
  SpeakerDirectoryResult,
  VoiceEnrollmentPreview,
  VoiceEnrollmentResult,
} from './types.js';

/**
 * One REST endpoint: method, path, and response type. The response type rides
 * along as a phantom so call sites stay typed from the table alone.
 */
export interface Endpoint<Response> {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly response?: Response;
}

function endpoint<Response>(method: 'GET' | 'POST', path: string): Endpoint<Response> {
  return { method, path };
}

/** The whole REST surface. Adding an endpoint is one entry here. */
export const endpoints = {
  analyzeAudio: endpoint<Record<string, unknown>>('POST', '/v1/analyze/audio'),
  analyzeBase64: endpoint<Record<string, unknown>>('POST', '/v1/analyze/base64'),
  submitCorrection: endpoint<{ status: string }>('POST', '/v1/feedback/correction'),
  submitSessionOutcome: endpoint<{ status: string }>('POST', '/v1/feedback/session_outcome'),
  listSpeakers: endpoint<SpeakerDirectoryResult>('GET', '/v1/voice/speakers'),
  previewEnrollment: endpoint<VoiceEnrollmentPreview>('POST', '/v1/voice/enrollments/preview'),
  confirmEnrollment: endpoint<VoiceEnrollmentResult>('POST', '/v1/voice/enrollments/confirm'),
  createRealtimeSession: endpoint<RealtimeSessionCredentials>('POST', '/v1/realtime/sessions'),
  memoryRecall: endpoint<RecallResult>('POST', '/v1/memory/recall'),
  phoneticsIpa: endpoint<IpaTranscription>('POST', '/v1/phonetics/ipa'),
  health: endpoint<{ status: string }>('GET', '/health'),
} as const;

export function callJSON<Response>(
  target: Endpoint<Response>,
  opts: RequestOptions,
  payload: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  return postJSON<Response>(target.path, opts, payload, signal);
}

export function callForm<Response>(
  target: Endpoint<Response>,
  opts: RequestOptions,
  formData: FormData,
  signal?: AbortSignal,
): Promise<Response> {
  return postForm<Response>(target.path, opts, formData, signal);
}

export function callQuery<Response>(
  target: Endpoint<Response>,
  opts: RequestOptions,
  query?: Record<string, string | number>,
  signal?: AbortSignal,
): Promise<Response> {
  const search = query ? new URLSearchParams(
    Object.entries(query).map(([key, value]) => [key, String(value)]),
  ).toString() : '';
  const path = search ? `${target.path}?${search}` : target.path;
  return requestJSON<Response>(target.method, path, opts, null, undefined, signal);
}
