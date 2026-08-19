import { measurementFromState, } from './conversation/prosody.js';
import { byMagnitude, momentsFromEvents, } from './conversation/moments.js';
import { VoiceFrame, } from './step.js';
/**
 * Validate the stable batch envelope.
 *
 * ProsodySSM's product output is `acoustic_state`, the measured waveform
 * values per window, which arrives on `prosody_timeline` and on each turn.
 * Valence / arousal / dominance are the trained affect head's readout; each
 * is `null` on an unvoiced frame, never a fabricated neutral. The head is
 * always trained, so a deployment that publishes only acoustic state is
 * still a correct deployment.
 */
export function parseAnalysisResult(value) {
    if (!isRecord(value)) {
        throw new Error('Analysis result must be a JSON object');
    }
    if (typeof value.prediction_id !== 'string' || !value.prediction_id) {
        throw new Error('Analysis result missing prediction_id');
    }
    if (typeof value.text !== 'string') {
        throw new Error('Analysis result missing text');
    }
    if (!isRecord(value.prosody)) {
        throw new Error('Analysis result missing prosody');
    }
    if (typeof value.duration !== 'number' || typeof value.word_count !== 'number') {
        throw new Error('Analysis result missing audio metadata');
    }
    return value;
}
/**
 * Consumer view of one analyzed recording.
 *
 * Accessors over the measured acoustic timeline, transcript, and recording-local
 * committed identity lanes. Persistent identity lives under `client.speakers`.
 */
export class ConversationAnalysis {
    result;
    constructor(data) {
        this.result = data;
    }
    /** Full transcript text. */
    getTranscript() {
        return this.result.text;
    }
    /** Diarized turns, in order. */
    getTurns() {
        return [...(this.result.turns ?? [])];
    }
    /** One turn by index, or null when out of range. */
    getTurn(index) {
        if (!Number.isInteger(index) || index < 0)
            return null;
        return this.result.turns?.[index] ?? null;
    }
    /** Recording-local speakers with talk time and turn counts. */
    getSpeakers() {
        return recordingSpeakers(this.result);
    }
    /** Measured frames produced from Mimi-latent recurrent analysis. */
    getFrames(speakerId) {
        return voiceFrames(this.result)
            .filter((point) => speakerId === undefined || point.speaker_id === speakerId)
            .map((point) => VoiceFrame.fromTimelinePoint(point));
    }
    /** One frame by index, or null when out of range. */
    getVoiceFrame(index) {
        const windows = this.getFrames();
        if (!Number.isInteger(index) || index < 0 || index >= windows.length)
            return null;
        return windows[index] ?? null;
    }
    /** One physical measurement across the recording, optionally for one speaker. */
    getMeasurementSeries(path, speakerId) {
        return this.getFrames(speakerId).flatMap((window) => {
            const value = measurementFromState(window.getAcousticState(), path);
            return value === null ? [] : [{
                    startMs: window.startMs,
                    endMs: window.endMs,
                    speakerId: window.speakerId,
                    value,
                }];
        });
    }
    /** Speaker-relative changes. The first window in each speaker lane has none. */
    getChanges(speakerId) {
        return this.getFrames(speakerId).flatMap((window) => {
            const delta = window.getChange();
            if (!delta)
                return [];
            return [{
                    startMs: window.startMs,
                    endMs: window.endMs,
                    speakerId: window.speakerId,
                    reference: delta.reference,
                    values: delta.values,
                }];
        });
    }
    /**
     * Moments the model committed, in commit order.
     *
     * Each carries the magnitude the model published on its `state_delta`
     * event. Empty when the deployment committed none.
     */
    getMoments(speakerId) {
        return momentsFromEvents(this.result.events, this.result.turns).filter((moment) => speakerId === undefined || moment.speakerId === speakerId);
    }
    /** The moments that moved the speaker furthest, largest first. */
    getTopMoments(limit = 10, speakerId) {
        return byMagnitude(this.getMoments(speakerId)).slice(0, Math.max(0, limit));
    }
    /** The measurement bundle on the latest (or indexed) acoustic window. */
    getProsody(windowIndex) {
        if (windowIndex === undefined) {
            const windows = this.getFrames();
            return windows[windows.length - 1]?.getProsody() ?? null;
        }
        return this.getVoiceFrame(windowIndex)?.getProsody() ?? null;
    }
    /**
     * Affect VAD for the whole file. Each component is `null` on an unvoiced
     * frame; the head is always trained. Null when every dimension is null.
     */
    getVad() {
        const { valence, arousal, dominance } = this.result.prosody;
        if (valence == null && arousal == null && dominance == null)
            return null;
        return { valence, arousal, dominance };
    }
    /** Valence for the whole file, or for one turn. Null on an unvoiced frame. */
    getValence(turnIndex) {
        if (turnIndex === undefined)
            return finiteOrNull(this.result.prosody.valence);
        return finiteOrNull(this.getTurn(turnIndex)?.prosody?.valence ?? null);
    }
    /** Raw API timeline for consumers that need the wire shape. */
    getTimeline() {
        return [...(this.result.prosody_timeline ?? [])];
    }
}
function recordingSpeakers(result) {
    const ids = [];
    const seen = new Set();
    const turnCounts = new Map();
    const turnDurations = new Map();
    const windowCounts = new Map();
    const add = (speakerId) => {
        if (speakerId && !seen.has(speakerId)) {
            seen.add(speakerId);
            ids.push(speakerId);
        }
    };
    for (const turn of result.turns ?? []) {
        add(turn.speaker_id);
        turnCounts.set(turn.speaker_id, (turnCounts.get(turn.speaker_id) ?? 0) + 1);
        turnDurations.set(turn.speaker_id, (turnDurations.get(turn.speaker_id) ?? 0) + Math.max(0, turn.end_ms - turn.start_ms));
    }
    for (const speaker of result.per_speaker ?? [])
        add(speaker.speaker_id);
    for (const speakerId of result.diarization?.speakers ?? [])
        add(speakerId);
    for (const point of result.prosody_timeline ?? []) {
        add(point.speaker_id);
        if (point.speaker_id) {
            windowCounts.set(point.speaker_id, (windowCounts.get(point.speaker_id) ?? 0) + 1);
        }
    }
    const summaries = new Map((result.per_speaker ?? []).map((speaker) => [speaker.speaker_id, speaker]));
    return ids.map((speakerId) => {
        const summary = summaries.get(speakerId);
        return {
            speaker_id: speakerId,
            talk_ms: summary?.talk_ms ?? turnDurations.get(speakerId) ?? 0,
            turn_count: turnCounts.get(speakerId) ?? 0,
            window_count: summary?.window_count ?? windowCounts.get(speakerId) ?? 0,
        };
    });
}
/**
 * The measured windows of a call, in order.
 *
 * Empty when the upload was not diarized (`diarize: false`), since the timeline
 * is only built for a diarized call.
 */
export function voiceFrames(result) {
    return (result.prosody_timeline ?? []).filter((point) => point.acoustic_state != null);
}
/**
 * Read one measurement across a call, skipping windows where it was not
 * measurable (an unvoiced window carries `null` pitch, without any floor value).
 */
export function measurementSeries(result, path) {
    const series = [];
    for (const point of voiceFrames(result)) {
        const value = measurementFromState(point.acoustic_state ?? null, path);
        if (value !== null) {
            series.push({
                start_ms: point.start_ms,
                end_ms: point.end_ms,
                speaker_id: point.speaker_id,
                value,
            });
        }
    }
    return series;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function finiteOrNull(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
