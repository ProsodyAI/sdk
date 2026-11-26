import { postForm, postJSON, request, requestJSON } from './http.js';
function endpoint(method, path) {
    return { method, path };
}
function control(path, method) {
    return { path, method };
}
/** The whole REST surface. Adding an endpoint is one entry here. */
export const endpoints = {
    analyzeAudio: endpoint('POST', '/v1/analyze/audio'),
    analyzeUrl: endpoint('POST', '/v1/analyze/url'),
    analyzeBase64: endpoint('POST', '/v1/analyze/base64'),
    submitCorrection: endpoint('POST', '/v1/feedback/correction'),
    submitSessionOutcome: endpoint('POST', '/v1/feedback/session_outcome'),
    listSpeakers: endpoint('GET', '/v1/voice/speakers'),
    previewEnrollment: endpoint('POST', '/v1/voice/enrollments/preview'),
    confirmEnrollment: endpoint('POST', '/v1/voice/enrollments/confirm'),
    memoryRecall: endpoint('POST', '/v1/memory/recall'),
    phoneticsIpa: endpoint('POST', '/v1/phonetics/ipa'),
    health: endpoint('GET', '/health'),
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
};
function filled(route, params) {
    return route.path.replace(/\{([a-z]+)\}/g, (_, name) => {
        const value = params[name];
        if (!value)
            throw new Error(`${route.path} needs ${name}`);
        return encodeURIComponent(value);
    });
}
function versionOf(etag) {
    if (!etag)
        return null;
    const version = Number(etag.replace(/^W\//, '').replace(/"/g, ''));
    return Number.isInteger(version) ? version : null;
}
export async function callControl(route, opts, call, signal) {
    const query = call.query
        ? new URLSearchParams(Object.entries(call.query)
            .filter(([, value]) => value !== undefined && value !== null)
            .map(([key, value]) => [key, String(value)])).toString()
        : '';
    const path = `${filled(route, call.path)}${query ? `?${query}` : ''}`;
    const headers = {};
    if (call.body !== undefined)
        headers['Content-Type'] = 'application/json';
    if (call.ifMatch !== undefined)
        headers['If-Match'] = `"${call.ifMatch}"`;
    if (call.ifNoneMatch)
        headers['If-None-Match'] = '*';
    if (call.idempotencyKey)
        headers['Idempotency-Key'] = call.idempotencyKey;
    const response = await request(route.method.toUpperCase(), path, opts, call.body === undefined ? null : JSON.stringify(call.body), headers, signal);
    return {
        body: (await response.json()),
        version: versionOf(response.headers.get('etag')),
        replayed: response.headers.get('idempotent-replayed') === 'true',
        requestId: response.headers.get('x-request-id'),
    };
}
export function callJSON(target, opts, payload, signal) {
    return postJSON(target.path, opts, payload, signal);
}
export function callForm(target, opts, formData, signal) {
    return postForm(target.path, opts, formData, signal);
}
export function callQuery(target, opts, query, signal) {
    const search = query ? new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)])).toString() : '';
    const path = search ? `${target.path}?${search}` : target.path;
    return requestJSON(target.method, path, opts, null, undefined, signal);
}
