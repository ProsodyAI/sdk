import { applyCommittedSpans, applySpeakerUpdateToSegments, mergeTranscriptUpdateSegments, } from './transcript-merge.js';
import { isKnownSpeaker, normalizeSpeakerId } from './turn-model.js';
/** The agent is the other party on the call; its words carry this fixed label. */
export const AGENT_SPEAKER_ID = 'agent';
/** Caller words the deployment attributed to no speaker carry this label. */
export const UNKNOWN_SPEAKER_ID = 'unknown';
export const ROOM_TRANSCRIPT_EVENT = 'prosodyai.transcript';
export const ROOM_SPEAKER_CHANGE_EVENT = 'prosodyai.speaker_change';
/** The words on a room's data topic come from the ProsodyAI deployment. */
const ROOM_PROVIDER = 'prosodyai';
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function finiteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
/**
 * Decode one room data-topic payload into the events this model reads, or
 * null for any other event type or a malformed one.
 */
export function parseRoomTranscriptInput(payload) {
    if (!isRecord(payload))
        return null;
    if (payload.type === ROOM_TRANSCRIPT_EVENT) {
        const speakerId = typeof payload.speaker_id === 'string' ? payload.speaker_id : null;
        if (speakerId === null || !Array.isArray(payload.deltas))
            return null;
        const deltas = [];
        for (const entry of payload.deltas) {
            if (!isRecord(entry) || typeof entry.text !== 'string')
                return null;
            const startMs = finiteNumber(entry.start_ms);
            const endMs = finiteNumber(entry.end_ms);
            if (startMs === null || endMs === null)
                return null;
            deltas.push({ text: entry.text, start_ms: startMs, end_ms: endMs, final: entry.final !== false });
        }
        return { type: ROOM_TRANSCRIPT_EVENT, speaker_id: speakerId, deltas };
    }
    if (payload.type === ROOM_SPEAKER_CHANGE_EVENT) {
        const timestampMs = finiteNumber(payload.timestamp_ms);
        if (timestampMs === null || typeof payload.speaker_id !== 'string')
            return null;
        return {
            type: ROOM_SPEAKER_CHANGE_EVENT,
            timestamp_ms: timestampMs,
            speaker_id: payload.speaker_id,
            is_agent: payload.is_agent === true,
        };
    }
    return null;
}
/**
 * The transcript a room's data topic builds, as a reader sees it.
 *
 * Words: an interim opens a result and later interims keep it; the next final
 * takes the same id, so the whole word replaces the forming one, whichever
 * speaker either arrived under. A final with nothing forming is appended.
 *
 * Speakers: a `speaker_change` is an onset. The voice on the floor owns the
 * unattributed words from its onset until the next different onset; the first
 * onset also owns the unattributed words before it, since no other voice was
 * on the floor. A word the model already attributed keeps its speaker. The
 * agent's words arrive on their fixed lane and are never relabeled.
 */
export class RoomTranscript {
    segments = [];
    spans = [];
    floor = null;
    agentSpeakerIds = new Set([normalizeSpeakerId(AGENT_SPEAKER_ID)]);
    openWordResult = null;
    wordResults = 0;
    /** Feed one decoded room payload; events this model does not read are ignored. */
    observe(payload) {
        const event = parseRoomTranscriptInput(payload);
        if (event === null)
            return;
        if (event.type === ROOM_TRANSCRIPT_EVENT)
            this.transcript(event);
        else
            this.speakerChange(event);
    }
    /**
     * Every held segment, agent lines included, in session-clock order, with
     * the callers' unattributed runs resolved the way a reader resolves them:
     * a run before any caller voice belongs to the first voice after it, and a
     * run between two spans of the same voice belongs to that voice. Only whole
     * words resolve; a word still forming keeps its label.
     */
    all() {
        const sorted = this.segments
            .map((segment) => ({ ...segment }))
            .sort((a, b) => a.start_ms - b.start_ms || a.end_ms - b.end_ms);
        const callers = sorted.filter((segment) => !this.isAgent(segment.speaker_id));
        for (let index = 0; index < callers.length;) {
            if (isKnownSpeaker(callers[index].speaker_id)) {
                index += 1;
                continue;
            }
            const runStart = index;
            while (index < callers.length && !isKnownSpeaker(callers[index].speaker_id))
                index += 1;
            const left = callers[runStart - 1];
            const right = callers[index];
            const run = callers.slice(runStart, index);
            if (!right?.is_final || !run.every((segment) => segment.is_final))
                continue;
            const owner = normalizeSpeakerId(right.speaker_id);
            const bridged = left === undefined || (left.is_final && normalizeSpeakerId(left.speaker_id) === owner);
            if (!bridged)
                continue;
            for (const segment of run)
                segment.speaker_id = owner;
        }
        return sorted;
    }
    /** The callers' whole words, in session-clock order. */
    words() {
        return this.all().filter((segment) => segment.is_final && !this.isAgent(segment.speaker_id));
    }
    /** The callers' words still forming: an interim no final has superseded. */
    forming() {
        return this.all().filter((segment) => !segment.is_final && !this.isAgent(segment.speaker_id));
    }
    /** The callers' whole words no speaker owns. */
    unattributedWords() {
        return this.words().filter((segment) => !isKnownSpeaker(segment.speaker_id));
    }
    /** The distinct caller speakers that own whole words. */
    speakers() {
        return [...new Set(this.words().map((segment) => segment.speaker_id).filter((id) => isKnownSpeaker(id)))].sort();
    }
    /** The callers' transcript as text. */
    text() {
        return this.words().map((segment) => segment.text).join(' ');
    }
    /** The agent's line as text. */
    agentText() {
        return this.all()
            .filter((segment) => this.isAgent(segment.speaker_id))
            .map((segment) => segment.text)
            .join(' ');
    }
    isAgent(speakerId) {
        return this.agentSpeakerIds.has(normalizeSpeakerId(speakerId));
    }
    transcript(event) {
        if (this.isAgent(event.speaker_id)) {
            this.segments = mergeTranscriptUpdateSegments(this.segments, event.deltas.map((delta) => ({
                start_ms: delta.start_ms,
                end_ms: delta.end_ms,
                text: delta.text,
                speaker_id: event.speaker_id,
                provider: ROOM_PROVIDER,
                result_id: '',
                is_final: true,
                speaker_committed: true,
            })), '', true);
            return;
        }
        for (const delta of event.deltas) {
            let resultId = this.openWordResult ?? '';
            if (!delta.final && this.openWordResult === null) {
                resultId = `room-word-${this.wordResults}`;
                this.wordResults += 1;
            }
            this.openWordResult = delta.final ? null : resultId;
            const attributed = isKnownSpeaker(event.speaker_id);
            this.segments = mergeTranscriptUpdateSegments(this.segments, [{
                    start_ms: delta.start_ms,
                    end_ms: delta.end_ms,
                    text: delta.text,
                    speaker_id: attributed ? event.speaker_id : this.floorSpeakerFor(delta.start_ms),
                    provider: ROOM_PROVIDER,
                    result_id: resultId,
                    is_final: delta.final,
                    speaker_committed: attributed,
                }], resultId, delta.final);
        }
        this.segments = applyCommittedSpans(this.segments, this.spans);
    }
    /** The voice on the floor at `startMs`, for a word the model left unattributed. */
    floorSpeakerFor(startMs) {
        const floor = this.floor;
        if (floor === null || this.isAgent(floor.speaker_id))
            return UNKNOWN_SPEAKER_ID;
        return startMs >= floor.timestamp_ms ? floor.speaker_id : UNKNOWN_SPEAKER_ID;
    }
    speakerChange(event) {
        if (event.is_agent)
            this.agentSpeakerIds.add(normalizeSpeakerId(event.speaker_id));
        const floor = this.floor;
        if (floor === null) {
            this.floor = event;
            if (!event.is_agent)
                this.commitSpan(0, event.timestamp_ms, event.speaker_id);
            return;
        }
        if (floor.speaker_id === event.speaker_id) {
            this.floor = { ...floor, is_agent: floor.is_agent || event.is_agent };
            return;
        }
        if (event.timestamp_ms <= floor.timestamp_ms)
            return;
        this.floor = event;
        if (!floor.is_agent)
            this.commitSpan(floor.timestamp_ms, event.timestamp_ms, floor.speaker_id);
    }
    commitSpan(startMs, endMs, speakerId) {
        if (endMs <= startMs)
            return;
        this.spans.push({ startMs, endMs, speakerId });
        this.segments = applySpeakerUpdateToSegments(this.segments, startMs, endMs, speakerId);
    }
}
