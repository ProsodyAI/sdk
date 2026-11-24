import type { RequestOptions } from './http.js';
import { postForm, postJSON, request, requestJSON } from './http.js';
import type { paths } from './types/control.js';
import type { RecallResult } from './types/memory.js';
import type { IpaTranscription } from './types/phonetics.js';
import type {
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

export type ControlMethod = 'get' | 'put' | 'post' | 'patch';

type Operation<P extends keyof paths, M extends ControlMethod> = NonNullable<paths[P][M]>;

type Declared<P extends keyof paths, M extends ControlMethod> = [Operation<P, M>] extends [never] ? never : M;

export interface ControlRoute<P extends keyof paths = keyof paths, M extends ControlMethod = ControlMethod> {
  readonly path: P;
  readonly method: M;
}

function control<P extends keyof paths, M extends ControlMethod>(path: P, method: Declared<P, M>): ControlRoute<P, M> {
  return { path, method };
}

type Json<Content> = Content extends { content: { 'application/json': infer Body } } ? Body : never;

type Success<Responses> = Responses extends { 200: infer Ok }
  ? Json<Ok>
  : Responses extends { 201: infer Created }
    ? Json<Created>
    : Responses extends { 202: infer Accepted }
      ? Json<Accepted>
      : never;

export type ControlResponse<R extends ControlRoute> =
  Operation<R['path'], R['method']> extends { responses: infer Responses } ? Success<Responses> : never;

export type ControlBody<R extends ControlRoute> =
  Operation<R['path'], R['method']> extends { requestBody: { content: { 'application/json': infer Body } } } ? Body : never;

export type ControlPath<R extends ControlRoute> =
  Operation<R['path'], R['method']> extends { parameters: { path: infer Params } } ? Params : never;

export type ControlQuery<R extends ControlRoute> =
  Operation<R['path'], R['method']> extends { parameters: { query?: infer Query } } ? NonNullable<Query> : never;

export interface ControlCall<R extends ControlRoute> {
  path: ControlPath<R>;
  query?: ControlQuery<R>;
  body?: ControlBody<R>;
  ifMatch?: number;
  ifNoneMatch?: boolean;
  idempotencyKey?: string;
}

export interface ControlResult<Body> {
  body: Body;
  version: number | null;
  replayed: boolean;
  requestId: string | null;
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
  memoryRecall: endpoint<RecallResult>('POST', '/v1/memory/recall'),
  phoneticsIpa: endpoint<IpaTranscription>('POST', '/v1/phonetics/ipa'),
  health: endpoint<{ status: string }>('GET', '/health'),
  putDirective: control('/v1/accounts/{account}/directives/{directive}', 'put'),
  listDirectives: control('/v1/accounts/{account}/directives', 'get'),
  putLexicon: control('/v1/accounts/{account}/lexicon', 'put'),
  createBundle: control('/v1/accounts/{account}/bundles', 'post'),
  getBundle: control('/v1/accounts/{account}/bundles/{bundle}', 'get'),
  putPolicy: control('/v1/accounts/{account}/policies/{policy}', 'put'),
  getPolicy: control('/v1/accounts/{account}/policies/{policy}', 'get'),
  getCallState: control('/v1/calls/{call}/state', 'get'),
  listTransitions: control('/v1/calls/{call}/transitions', 'get'),
  createAgent: control('/v1/accounts/{account}/agents', 'post'),
  updateAgent: control('/v1/accounts/{account}/agents/{agent}', 'patch'),
  getAgent: control('/v1/accounts/{account}/agents/{agent}', 'get'),
  listAgents: control('/v1/accounts/{account}/agents', 'get'),
  getAccount: control('/v1/accounts/{account}', 'get'),
  setAccountLimits: control('/v1/accounts/{account}/limits', 'put'),
} as const;

function filled(route: ControlRoute, params: Record<string, string>): string {
  return route.path.replace(/\{([a-z]+)\}/g, (_, name: string) => {
    const value = params[name];
    if (!value) throw new Error(`${route.path} needs ${name}`);
    return encodeURIComponent(value);
  });
}

function versionOf(etag: string | null): number | null {
  if (!etag) return null;
  const version = Number(etag.replace(/^W\//, '').replace(/"/g, ''));
  return Number.isInteger(version) ? version : null;
}

export async function callControl<R extends ControlRoute>(
  route: R,
  opts: RequestOptions,
  call: ControlCall<R>,
  signal?: AbortSignal,
): Promise<ControlResult<ControlResponse<R>>> {
  const query = call.query
    ? new URLSearchParams(
        Object.entries(call.query as Record<string, unknown>)
          .filter(([, value]) => value !== undefined && value !== null)
          .map(([key, value]) => [key, String(value)]),
      ).toString()
    : '';
  const path = `${filled(route, call.path as Record<string, string>)}${query ? `?${query}` : ''}`;
  const headers: Record<string, string> = {};
  if (call.body !== undefined) headers['Content-Type'] = 'application/json';
  if (call.ifMatch !== undefined) headers['If-Match'] = `"${call.ifMatch}"`;
  if (call.ifNoneMatch) headers['If-None-Match'] = '*';
  if (call.idempotencyKey) headers['Idempotency-Key'] = call.idempotencyKey;
  const response = await request(
    route.method.toUpperCase(),
    path,
    opts,
    call.body === undefined ? null : JSON.stringify(call.body),
    headers,
    signal,
  );
  return {
    body: (await response.json()) as ControlResponse<R>,
    version: versionOf(response.headers.get('etag')),
    replayed: response.headers.get('idempotent-replayed') === 'true',
    requestId: response.headers.get('x-request-id'),
  };
}

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
