import { AcousticWindow, } from './step.js';
/**
 * Validate the stable batch envelope.
 *
 * ProsodySSM's product output is `acoustic_state` — measured waveform values
 * per window — which arrives on `prosody_timeline` and on each turn. Valence /
 * arousal / dominance are only readings when `affect_available` is true, so
 * they are never required here: a deployment that publishes measurements and
 * no affect is a correct deployment, not a malformed response.
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
    if (value.affect_available === true) {
        for (const field of ['valence', 'arousal', 'dominance']) {
            if (typeof value.prosody[field] !== 'number') {
                throw new Error(`Analysis result declares affect_available but prosody.${field} is not a number`);
            }
        }
    }
    return value;
}
/**
 * Consumer view of one analyzed recording.
 *
 * Accessors over the measured acoustic timeline, transcript, and recording-local
 * diarizer lanes. Persistent identity lives under `client.speakers`.
 */
export class ConversationAnalysis {
    result;
    constructor(data) {
        this.result = data;
    }
    getTranscript() {
        return this.result.text;
    }
    getTurns() {
        return [...(this.result.turns ?? [])];
    }
    getTurn(index) {
        if (!Number.isInteger(index) || index < 0)
            return null;
        return this.result.turns?.[index] ?? null;
    }
    getSpeakers() {
        return recordingSpeakers(this.result);
    }
    /** Measured windows produced from Mimi-latent recurrent analysis. */
    getAcoustics(speakerId) {
        const affectAvailable = this.result.affect_available === true;
        return acousticWindows(this.result)
            .filter((point) => speakerId === undefined || point.speaker_id === speakerId)
            .map((point) => AcousticWindow.fromTimelinePoint(point, { affectAvailable }));
    }
    getAcousticWindow(index) {
        const windows = this.getAcoustics();
        if (!Number.isInteger(index) || index < 0 || index >= windows.length)
            return null;
        return windows[index] ?? null;
    }
    /** One physical measurement across the recording, optionally for one speaker. */
    getFeatureSeries(name, speakerId) {
        return this.getAcoustics(speakerId).flatMap((window) => {
            const value = window.getFeature(name);
            return value === null ? [] : [{
                    startMs: window.startMs,
                    endMs: window.endMs,
                    speakerId: window.speakerId,
                    value,
                }];
        });
    }
    /** Speaker-relative changes. The first window in each speaker lane has none. */
    getDeltas(speakerId) {
        return this.getAcoustics(speakerId).flatMap((window) => {
            const change = window.getAcousticChange();
            if (!change?.values)
                return [];
            const values = {};
            for (const [name, value] of Object.entries(change.values)) {
                if (typeof value === 'number' && Number.isFinite(value)) {
                    values[name] = value;
                }
            }
            return [{
                    startMs: window.startMs,
                    endMs: window.endMs,
                    speakerId: window.speakerId,
                    reference: change.reference ?? null,
                    values,
                }];
        });
    }
    /** Vocal features on the latest (or indexed) acoustic window. */
    getVocalFeatures(windowIndex) {
        if (windowIndex === undefined) {
            const windows = this.getAcoustics();
            return windows[windows.length - 1]?.getVocalFeatures() ?? null;
        }
        return this.getAcousticWindow(windowIndex)?.getVocalFeatures() ?? null;
    }
    /** Pitch series across windows, skipping unvoiced measurements. */
    getPitch(speakerId) {
        return this.getFeatureSeries('f0_median_hz', speakerId);
    }
    getPitchAt(windowIndex) {
        return this.getAcousticWindow(windowIndex)?.getPitch() ?? null;
    }
    /**
     * Affect VAD for the whole file when the checkpoint publishes it.
     * Null when `affect_available` is false.
     */
    getVad() {
        if (this.result.affect_available !== true)
            return null;
        return {
            valence: this.result.prosody.valence,
            arousal: this.result.prosody.arousal,
            dominance: this.result.prosody.dominance,
        };
    }
    getValence(turnIndex) {
        if (this.result.affect_available !== true)
            return null;
        if (turnIndex === undefined)
            return finiteOrNull(this.result.prosody.valence);
        return finiteOrNull(this.getTurn(turnIndex)?.prosody?.valence);
    }
    /** Raw API timeline for consumers that need the wire shape. */
    getTimeline() {
        return [...(this.result.prosody_timeline ?? [])];
    }
    /** @deprecated Use getAcoustics(). */
    getRecurrentSteps() {
        return this.getAcoustics();
    }
    /** @deprecated Use getAcousticWindow(). */
    getRecurrentStep(index) {
        return this.getAcousticWindow(index);
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
export function acousticWindows(result) {
    return (result.prosody_timeline ?? []).filter((point) => point.acoustic_state != null);
}
/**
 * Read one measured feature across a call, skipping windows where it was not
 * measurable (unvoiced windows carry `null` f0 rather than a floor value).
 */
export function acousticSeries(result, feature) {
    const series = [];
    for (const point of acousticWindows(result)) {
        const value = point.acoustic_state?.values?.[feature];
        if (typeof value === 'number' && Number.isFinite(value)) {
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
