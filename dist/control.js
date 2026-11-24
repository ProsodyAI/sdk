import { callControl, endpoints } from './endpoints.js';
export class ControlClient {
    opts;
    constructor(opts) {
        this.opts = opts;
    }
    putDirective(account, directive, precondition, signal) {
        return callControl(endpoints.putDirective, this.opts, { path: { account, directive: directive.id }, body: directive, ...precondition }, signal);
    }
    listDirectives(account, query, signal) {
        return callControl(endpoints.listDirectives, this.opts, { path: { account }, query }, signal);
    }
    putLexicon(account, lexicon, precondition = {}, signal) {
        return callControl(endpoints.putLexicon, this.opts, { path: { account }, body: lexicon, ...precondition }, signal);
    }
    createBundle(account, directives, idempotencyKey, signal) {
        const body = { accountId: account, directives, idempotencyKey };
        return callControl(endpoints.createBundle, this.opts, { path: { account }, body, idempotencyKey }, signal);
    }
    getBundle(account, bundle, signal) {
        return callControl(endpoints.getBundle, this.opts, { path: { account, bundle } }, signal);
    }
    putPolicy(account, policy, precondition, signal) {
        return callControl(endpoints.putPolicy, this.opts, { path: { account, policy: policy.id }, body: policy, ...precondition }, signal);
    }
    getPolicy(account, policy, version = 0, signal) {
        return callControl(endpoints.getPolicy, this.opts, { path: { account, policy }, query: { version } }, signal);
    }
    getCallState(call, signal) {
        return callControl(endpoints.getCallState, this.opts, { path: { call } }, signal);
    }
    listTransitions(call, after = 0, limit, signal) {
        return callControl(endpoints.listTransitions, this.opts, { path: { call }, query: { after, limit } }, signal);
    }
    createAgent(account, request, idempotencyKey, signal) {
        return callControl(endpoints.createAgent, this.opts, { path: { account }, body: { ...request, accountId: account }, idempotencyKey }, signal);
    }
    updateAgent(account, request, signal) {
        return callControl(endpoints.updateAgent, this.opts, { path: { account, agent: request.agentId }, body: request }, signal);
    }
    getAgent(account, agent, version = 0, signal) {
        return callControl(endpoints.getAgent, this.opts, { path: { account, agent }, query: { version } }, signal);
    }
    listAgents(account, query, signal) {
        return callControl(endpoints.listAgents, this.opts, { path: { account }, query }, signal);
    }
    getAccount(account, signal) {
        return callControl(endpoints.getAccount, this.opts, { path: { account } }, signal);
    }
    setAccountLimits(account, limits, signal) {
        return callControl(endpoints.setAccountLimits, this.opts, { path: { account }, body: { accountId: account, limits } }, signal);
    }
}
