import type { RequestOptions } from './http.js';
import type { paths } from './types/control.js';
import type { RecallResult } from './types/memory.js';
import type { IpaTranscription } from './types/phonetics.js';
import type { SpeakerDirectoryResult, VoiceEnrollmentPreview, VoiceEnrollmentResult } from './types.js';
/**
 * One REST endpoint: method, path, and response type. The response type rides
 * along as a phantom so call sites stay typed from the table alone.
 */
export interface Endpoint<Response> {
    readonly method: 'GET' | 'POST';
    readonly path: string;
    readonly response?: Response;
}
export type ControlMethod = 'get' | 'put' | 'post' | 'patch';
type Operation<P extends keyof paths, M extends ControlMethod> = NonNullable<paths[P][M]>;
export interface ControlRoute<P extends keyof paths = keyof paths, M extends ControlMethod = ControlMethod> {
    readonly path: P;
    readonly method: M;
}
type Json<Content> = Content extends {
    content: {
        'application/json': infer Body;
    };
} ? Body : never;
type Success<Responses> = Responses extends {
    200: infer Ok;
} ? Json<Ok> : Responses extends {
    201: infer Created;
} ? Json<Created> : Responses extends {
    202: infer Accepted;
} ? Json<Accepted> : never;
export type ControlResponse<R extends ControlRoute> = Operation<R['path'], R['method']> extends {
    responses: infer Responses;
} ? Success<Responses> : never;
export type ControlBody<R extends ControlRoute> = Operation<R['path'], R['method']> extends {
    requestBody: {
        content: {
            'application/json': infer Body;
        };
    };
} ? Body : never;
export type ControlPath<R extends ControlRoute> = Operation<R['path'], R['method']> extends {
    parameters: {
        path: infer Params;
    };
} ? Params : never;
export type ControlQuery<R extends ControlRoute> = Operation<R['path'], R['method']> extends {
    parameters: {
        query?: infer Query;
    };
} ? NonNullable<Query> : never;
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
export declare const endpoints: {
    readonly analyzeAudio: Endpoint<Record<string, unknown>>;
    readonly analyzeBase64: Endpoint<Record<string, unknown>>;
    readonly submitCorrection: Endpoint<{
        status: string;
    }>;
    readonly submitSessionOutcome: Endpoint<{
        status: string;
    }>;
    readonly listSpeakers: Endpoint<SpeakerDirectoryResult>;
    readonly previewEnrollment: Endpoint<VoiceEnrollmentPreview>;
    readonly confirmEnrollment: Endpoint<VoiceEnrollmentResult>;
    readonly memoryRecall: Endpoint<RecallResult>;
    readonly phoneticsIpa: Endpoint<IpaTranscription>;
    readonly health: Endpoint<{
        status: string;
    }>;
    readonly putDirective: ControlRoute<"/v1/accounts/{account}/directives/{directive}", "put">;
    readonly listDirectives: ControlRoute<"/v1/accounts/{account}/directives", "get">;
    readonly putLexicon: ControlRoute<"/v1/accounts/{account}/lexicon", "put">;
    readonly createBundle: ControlRoute<"/v1/accounts/{account}/bundles", "post">;
    readonly getBundle: ControlRoute<"/v1/accounts/{account}/bundles/{bundle}", "get">;
    readonly putPolicy: ControlRoute<"/v1/accounts/{account}/policies/{policy}", "put">;
    readonly getPolicy: ControlRoute<"/v1/accounts/{account}/policies/{policy}", "get">;
    readonly getCallState: ControlRoute<"/v1/calls/{call}/state", "get">;
    readonly listTransitions: ControlRoute<"/v1/calls/{call}/transitions", "get">;
    readonly createAgent: ControlRoute<"/v1/accounts/{account}/agents", "post">;
    readonly updateAgent: ControlRoute<"/v1/accounts/{account}/agents/{agent}", "patch">;
    readonly getAgent: ControlRoute<"/v1/accounts/{account}/agents/{agent}", "get">;
    readonly listAgents: ControlRoute<"/v1/accounts/{account}/agents", "get">;
    readonly getAccount: ControlRoute<"/v1/accounts/{account}", "get">;
    readonly setAccountLimits: ControlRoute<"/v1/accounts/{account}/limits", "put">;
};
export declare function callControl<R extends ControlRoute>(route: R, opts: RequestOptions, call: ControlCall<R>, signal?: AbortSignal): Promise<ControlResult<ControlResponse<R>>>;
export declare function callJSON<Response>(target: Endpoint<Response>, opts: RequestOptions, payload: unknown, signal?: AbortSignal): Promise<Response>;
export declare function callForm<Response>(target: Endpoint<Response>, opts: RequestOptions, formData: FormData, signal?: AbortSignal): Promise<Response>;
export declare function callQuery<Response>(target: Endpoint<Response>, opts: RequestOptions, query?: Record<string, string | number>, signal?: AbortSignal): Promise<Response>;
export {};
