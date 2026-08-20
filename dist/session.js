import { VoiceFrame } from './step.js';
/** Default LiveKit data topic matching API `livekit_event_topic`. */
export const PROSODY_EVENT_TOPIC = 'prosody.events.v1';
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
    // be non-negative integers so clients can drop stale LiveKit republishes.
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
/**
 * Consumes Prosody analysis events off a LiveKit room's data topic.
 *
 * Audio rides the LiveKit media plane; an agent worker (or the Python
 * `livekit-plugins-prosodyai` plugin) bridges the track to the analysis
 * WebSocket and republishes events to this topic. This class parses, orders
 * by `generation`/`seq` when present, and fans out to typed handlers.
 */
export class ProsodySession {
    room;
    options;
    topic;
    isStarted = false;
    currentGeneration = null;
    currentSeq = -1;
    constructor(room, options) {
        if (!options.sessionId) {
            throw new Error('ProsodySession requires a sessionId');
        }
        this.room = room;
        this.options = options;
        this.topic = options.topic ?? PROSODY_EVENT_TOPIC;
    }
    /** Highest event generation seen, when the wire carries ordering. */
    get generation() {
        return this.currentGeneration;
    }
    /** Highest event sequence seen, when the wire carries ordering. */
    get lastSeq() {
        return this.currentSeq >= 0 ? this.currentSeq : null;
    }
    /** Subscribe to the room data topic. Idempotent. */
    start() {
        if (this.isStarted)
            return this;
        this.room.on('dataReceived', this.handleRoomData);
        this.isStarted = true;
        return this;
    }
    /** Unsubscribe from the room data topic. Idempotent. */
    stop() {
        if (!this.isStarted)
            return;
        this.room.off('dataReceived', this.handleRoomData);
        this.isStarted = false;
    }
    handleRoomData = (payload, participant, _kind, topic) => {
        if (topic !== this.topic)
            return;
        if (this.options.participantIdentity
            && participant?.identity !== this.options.participantIdentity) {
            return;
        }
        try {
            const event = parseProsodyEvent(payload);
            if (event.session_id !== this.options.sessionId || !this.acceptSequence(event)) {
                return;
            }
            this.dispatch(event);
        }
        catch (error) {
            this.options.onError?.(toError(error));
        }
    };
    acceptSequence(event) {
        // API wire may omit ordering fields; accept in arrival order.
        if (event.generation === undefined || event.seq === undefined) {
            return true;
        }
        if (this.currentGeneration !== null
            && event.generation < this.currentGeneration) {
            return false;
        }
        if (this.currentGeneration === null || event.generation > this.currentGeneration) {
            this.currentGeneration = event.generation;
            this.currentSeq = -1;
        }
        if (event.seq <= this.currentSeq)
            return false;
        this.currentSeq = event.seq;
        return true;
    }
    dispatch(event) {
        switch (event.type) {
            case 'directive': {
                this.options.onDirective?.(event);
                const frame = VoiceFrame.fromDirective(event);
                this.options.onVoiceFrame?.(frame);
                this.options.conversation?.apply(event);
                break;
            }
            case 'transcript_update':
                this.options.onTranscriptUpdate?.(event);
                this.options.conversation?.apply(event);
                break;
            case 'speaker_update':
                this.options.onSpeakerUpdate?.(event);
                this.options.conversation?.apply(event);
                break;
            case 'speaker_profiles':
                this.options.onSpeakerProfiles?.(event);
                this.options.conversation?.apply(event);
                break;
            case 'state_delta':
                this.options.onStateDelta?.(event);
                this.options.conversation?.apply(event);
                break;
            case 'turn_boundary':
                this.options.onTurnBoundary?.(event);
                break;
            case 'barge_in':
                this.options.onBargeIn?.(event);
                break;
            case 'session_end':
                this.options.onSessionEnd?.(event);
                this.options.conversation?.apply(event);
                break;
            case 'warning':
                this.options.onWarning?.(event);
                break;
            case 'error':
                this.options.onServerError?.(event);
                break;
        }
        this.options.onEvent?.(event);
    }
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
function toError(value) {
    return value instanceof Error ? value : new Error(String(value));
}
