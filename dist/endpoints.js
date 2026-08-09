import { postForm, postJSON, requestJSON } from './http.js';
function endpoint(method, path) {
    return { method, path };
}
/** The whole REST surface. Adding an endpoint is one entry here. */
export const endpoints = {
    analyzeAudio: endpoint('POST', '/v1/analyze/audio'),
    analyzeBase64: endpoint('POST', '/v1/analyze/base64'),
    submitCorrection: endpoint('POST', '/v1/feedback/correction'),
    submitSessionOutcome: endpoint('POST', '/v1/feedback/session_outcome'),
    listSpeakers: endpoint('GET', '/v1/voice/speakers'),
    previewEnrollment: endpoint('POST', '/v1/voice/enrollments/preview'),
    confirmEnrollment: endpoint('POST', '/v1/voice/enrollments/confirm'),
    createRealtimeSession: endpoint('POST', '/v1/realtime/sessions'),
    health: endpoint('GET', '/health'),
};
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
