import type { RequestOptions } from './http.js';
import { callControl, endpoints, type ControlBody, type ControlQuery, type ControlResult, type ControlResponse } from './endpoints.js';
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

type Named =
  | 'putDirective'
  | 'listDirectives'
  | 'putLexicon'
  | 'createBundle'
  | 'getBundle'
  | 'putPolicy'
  | 'getPolicy'
  | 'getCallState'
  | 'listTransitions'
  | 'createAgent'
  | 'updateAgent'
  | 'getAgent'
  | 'listAgents'
  | 'getAccount'
  | 'setAccountLimits';

type Result<Name extends Named> = Promise<ControlResult<ControlResponse<(typeof endpoints)[Name]>>>;

export class ControlClient {
  constructor(private readonly opts: RequestOptions) {}

  putDirective(account: string, directive: Directive, precondition: Precondition, signal?: AbortSignal): Result<'putDirective'> {
    return callControl(endpoints.putDirective, this.opts, { path: { account, directive: directive.id }, body: directive, ...precondition }, signal);
  }

  listDirectives(account: string, query?: ControlQuery<typeof endpoints.listDirectives>, signal?: AbortSignal): Result<'listDirectives'> {
    return callControl(endpoints.listDirectives, this.opts, { path: { account }, query }, signal);
  }

  putLexicon(account: string, lexicon: Lexicon, precondition: Precondition = {}, signal?: AbortSignal): Result<'putLexicon'> {
    return callControl(endpoints.putLexicon, this.opts, { path: { account }, body: lexicon, ...precondition }, signal);
  }

  createBundle(account: string, directives: DirectiveRef[], idempotencyKey: string, signal?: AbortSignal): Result<'createBundle'> {
    const body: ControlBody<typeof endpoints.createBundle> = { accountId: account, directives, idempotencyKey };
    return callControl(endpoints.createBundle, this.opts, { path: { account }, body, idempotencyKey }, signal);
  }

  getBundle(account: string, bundle: string, signal?: AbortSignal): Result<'getBundle'> {
    return callControl(endpoints.getBundle, this.opts, { path: { account, bundle } }, signal);
  }

  putPolicy(account: string, policy: DialoguePolicy, precondition: Precondition, signal?: AbortSignal): Result<'putPolicy'> {
    return callControl(endpoints.putPolicy, this.opts, { path: { account, policy: policy.id }, body: policy, ...precondition }, signal);
  }

  getPolicy(account: string, policy: string, version = 0, signal?: AbortSignal): Result<'getPolicy'> {
    return callControl(endpoints.getPolicy, this.opts, { path: { account, policy }, query: { version } }, signal);
  }

  getCallState(call: string, signal?: AbortSignal): Result<'getCallState'> {
    return callControl(endpoints.getCallState, this.opts, { path: { call } }, signal);
  }

  listTransitions(call: string, after = 0, limit?: number, signal?: AbortSignal): Result<'listTransitions'> {
    return callControl(endpoints.listTransitions, this.opts, { path: { call }, query: { after, limit } }, signal);
  }

  createAgent(account: string, request: CreateAgentRequest, idempotencyKey: string, signal?: AbortSignal): Result<'createAgent'> {
    return callControl(endpoints.createAgent, this.opts, { path: { account }, body: { ...request, accountId: account }, idempotencyKey }, signal);
  }

  updateAgent(account: string, request: UpdateAgentRequest, signal?: AbortSignal): Result<'updateAgent'> {
    return callControl(endpoints.updateAgent, this.opts, { path: { account, agent: request.agentId }, body: request }, signal);
  }

  getAgent(account: string, agent: string, version = 0, signal?: AbortSignal): Result<'getAgent'> {
    return callControl(endpoints.getAgent, this.opts, { path: { account, agent }, query: { version } }, signal);
  }

  listAgents(account: string, query?: ControlQuery<typeof endpoints.listAgents>, signal?: AbortSignal): Result<'listAgents'> {
    return callControl(endpoints.listAgents, this.opts, { path: { account }, query }, signal);
  }

  getAccount(account: string, signal?: AbortSignal): Result<'getAccount'> {
    return callControl(endpoints.getAccount, this.opts, { path: { account } }, signal);
  }

  setAccountLimits(account: string, limits: Limits, signal?: AbortSignal): Result<'setAccountLimits'> {
    return callControl(endpoints.setAccountLimits, this.opts, { path: { account }, body: { accountId: account, limits } }, signal);
  }
}
