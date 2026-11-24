import type { RequestOptions } from './http.js';
import { endpoints, type ControlQuery, type ControlResult, type ControlResponse } from './endpoints.js';
import type { components } from './types/control.js';
type Schemas = components['schemas'];
export type Directive = Schemas['Directive-Input'];
export type DirectiveRef = Schemas['DirectiveRef'];
export type Lexicon = Schemas['Lexicon'];
export type Bundle = Schemas['Bundle'];
export type DialoguePolicy = Schemas['DialoguePolicy-Input'];
export type CallState = Schemas['State'];
export type Transition = Schemas['Transition'];
export type StateDelta = Schemas['DialogueStateDelta'];
export type Agent = Schemas['Agent'];
export type AgentConfig = Schemas['AgentConfig'];
export type CreateAgentRequest = Schemas['CreateAgentRequest'];
export type UpdateAgentRequest = Schemas['UpdateAgentRequest'];
export type Listening = Schemas['Listening'];
export type Limits = Schemas['Limits-Input'];
export type Account = Schemas['Account'];
export type ErrorEnvelope = Schemas['ErrorEnvelope'];
export interface Precondition {
    ifMatch?: number;
    ifNoneMatch?: boolean;
}
type Named = 'putDirective' | 'listDirectives' | 'putLexicon' | 'createBundle' | 'getBundle' | 'putPolicy' | 'getPolicy' | 'getCallState' | 'listTransitions' | 'createAgent' | 'updateAgent' | 'getAgent' | 'listAgents' | 'getAccount' | 'setAccountLimits';
type Result<Name extends Named> = Promise<ControlResult<ControlResponse<(typeof endpoints)[Name]>>>;
export declare class ControlClient {
    private readonly opts;
    constructor(opts: RequestOptions);
    putDirective(account: string, directive: Directive, precondition: Precondition, signal?: AbortSignal): Result<'putDirective'>;
    listDirectives(account: string, query?: ControlQuery<typeof endpoints.listDirectives>, signal?: AbortSignal): Result<'listDirectives'>;
    putLexicon(account: string, lexicon: Lexicon, precondition?: Precondition, signal?: AbortSignal): Result<'putLexicon'>;
    createBundle(account: string, directives: DirectiveRef[], idempotencyKey: string, signal?: AbortSignal): Result<'createBundle'>;
    getBundle(account: string, bundle: string, signal?: AbortSignal): Result<'getBundle'>;
    putPolicy(account: string, policy: DialoguePolicy, precondition: Precondition, signal?: AbortSignal): Result<'putPolicy'>;
    getPolicy(account: string, policy: string, version?: number, signal?: AbortSignal): Result<'getPolicy'>;
    getCallState(call: string, signal?: AbortSignal): Result<'getCallState'>;
    listTransitions(call: string, after?: number, limit?: number, signal?: AbortSignal): Result<'listTransitions'>;
    createAgent(account: string, request: CreateAgentRequest, idempotencyKey: string, signal?: AbortSignal): Result<'createAgent'>;
    updateAgent(account: string, request: UpdateAgentRequest, signal?: AbortSignal): Result<'updateAgent'>;
    getAgent(account: string, agent: string, version?: number, signal?: AbortSignal): Result<'getAgent'>;
    listAgents(account: string, query?: ControlQuery<typeof endpoints.listAgents>, signal?: AbortSignal): Result<'listAgents'>;
    getAccount(account: string, signal?: AbortSignal): Result<'getAccount'>;
    setAccountLimits(account: string, limits: Limits, signal?: AbortSignal): Result<'setAccountLimits'>;
}
export {};
