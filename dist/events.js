const PROSODY_EVENT_TYPES = new Set([
    'directive',
    'transcript_update',
    'speaker_update',
    'speaker_profiles',
    'state_delta',
    'turn_boundary',
    'barge_in',
    'session_end',
    'warning',
    'error',
]);
export function parseProsodyEvent(input) {
    const value = decodeEventInput(input);
    if (!isRecord(value)) {
        throw new Error('Prosody event must be a JSON object');
    }
    const sessionId = value.session_id;
    const generation = value.generation;
    const seq = value.seq;
    const type = value.type;
    if (typeof sessionId !== 'string' || !sessionId) {
        throw new Error('Prosody event missing session_id');
    }
    // generation/seq are optional on the API wire today; when present they must
    // be non-negative integers so clients can drop stale or repeated events.
    if (generation !== undefined
        && (typeof generation !== 'number' || !Number.isInteger(generation) || generation < 0)) {
        throw new Error('Prosody event generation must be a non-negative integer');
    }
    if (seq !== undefined
        && (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 0)) {
        throw new Error('Prosody event seq must be a non-negative integer');
    }
    if (typeof type !== 'string' || !PROSODY_EVENT_TYPES.has(type)) {
        throw new Error(`Unsupported Prosody event type: ${String(type)}`);
    }
    return value;
}
function decodeEventInput(input) {
    if (typeof input === 'string')
        return JSON.parse(input);
    if (input instanceof Uint8Array) {
        return JSON.parse(new TextDecoder().decode(input));
    }
    if (input instanceof ArrayBuffer) {
        return JSON.parse(new TextDecoder().decode(new Uint8Array(input)));
    }
    return input;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
