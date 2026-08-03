import { AcousticWindow, } from './step.js';
import { ConversationAnalysis, } from './analysis.js';
/**
 * Developer product object for diarized turns and vocal measurements.
 *
 * Live: feed Prosody wire events via `apply`. Batch: `Conversation.fromAnalysis`.
 * Logic mirrors the demo transcript merge and turn builder so the SDK and demo
 * share one conversation spine.
 */
export class Conversation {
    segments = [];
    steps = [];
    affectAvailable = false;
    batch = null;
    static fromAnalysis(result) {
        const conversation = new Conversation();
        conversation.batch = new ConversationAnalysis(result);
        conversation.affectAvailable = result.affect_available === true;
        return conversation;
    }
    /** Ingest one live Prosody event (`directive`, `transcript_update`, …). */
    apply(event) {
        const type = String(event.type ?? '');
        if (type === 'directive') {
            const directive = event;
            this.affectAvailable = directive.affect_available === true || this.affectAvailable;
            this.steps.push({
                speaker_id: normalizeSpeakerId(directive.speaker_id),
                timestamp_ms: directive.timestamp_ms,
                acoustic_state: directive.acoustic_state ?? null,
                acoustic_change: directive.acoustic_change ?? null,
            });
            return this;
        }
        if (type === 'transcript_update') {
            const update = event;
            this.segments = mergeTranscriptUpdateSegments(this.segments, update.segments ?? [], update.result_id ?? '', Boolean(update.is_final), Boolean(update.speech_final));
            return this;
        }
        return this;
    }
    getTranscript() {
        if (this.batch)
            return this.batch.getTranscript();
        return this.getTurns().map((turn) => turn.text).join(' ').trim();
    }
    /** Diarized transcript turns with speaker_id (demo-equivalent spine). */
    getTurns() {
        if (this.batch) {
            return this.batch.getTurns().map((turn) => this.batchTurn(turn));
        }
        return buildTurnsFromSegments(this.segments, this.steps);
    }
    getTurn(index) {
        const turns = this.getTurns();
        if (!Number.isInteger(index) || index < 0 || index >= turns.length)
            return null;
        return turns[index] ?? null;
    }
    /**
     * Vocal features for a turn (overlap-weighted best step) or latest step.
     * Pass `turnIndex` for a turn; omit for the most recent recurrent step.
     */
    getVocalFeatures(turnIndex) {
        if (turnIndex !== undefined) {
            const turn = this.getTurn(turnIndex);
            return turn?.vocal ?? null;
        }
        if (this.batch) {
            const windows = this.batch.getAcoustics();
            const last = windows[windows.length - 1];
            return last ? vocalFeaturesFromWindow(last) : null;
        }
        const last = this.steps[this.steps.length - 1];
        if (!last?.acoustic_state)
            return null;
        return vocalFeaturesFromState(last.acoustic_state, last.acoustic_change);
    }
    getSpeakers() {
        if (this.batch)
            return this.batch.getSpeakers();
        const turns = this.getTurns();
        const windows = this.getAcoustics();
        const ids = new Set();
        for (const turn of turns)
            if (isKnownSpeaker(turn.speaker_id))
                ids.add(turn.speaker_id);
        for (const window of windows)
            if (isKnownSpeaker(window.speakerId))
                ids.add(window.speakerId);
        return [...ids].map((speakerId) => ({
            speaker_id: speakerId,
            talk_ms: turns
                .filter((turn) => turn.speaker_id === speakerId)
                .reduce((total, turn) => total + Math.max(0, turn.end_ms - turn.start_ms), 0),
            turn_count: turns.filter((turn) => turn.speaker_id === speakerId).length,
            window_count: windows.filter((window) => window.speakerId === speakerId).length,
        }));
    }
    /** All measured windows, optionally limited to one recording-local speaker. */
    getAcoustics(speakerId) {
        if (this.batch)
            return this.batch.getAcoustics(speakerId);
        return this.steps.map((step) => AcousticWindow.fromLiveStep({
            speakerId: step.speaker_id,
            timestampMs: step.timestamp_ms,
            acousticState: step.acoustic_state,
            acousticChange: step.acoustic_change,
            affectAvailable: this.affectAvailable,
        })).filter((window) => speakerId === undefined || window.speakerId === speakerId);
    }
    getAcousticWindow(index) {
        const windows = this.getAcoustics();
        if (!Number.isInteger(index) || index < 0 || index >= windows.length)
            return null;
        return windows[index] ?? null;
    }
    getFeatureSeries(name, speakerId) {
        if (this.batch)
            return this.batch.getFeatureSeries(name, speakerId);
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
    getDeltas(speakerId) {
        if (this.batch)
            return this.batch.getDeltas(speakerId);
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
    batchTurn(turn) {
        const state = turn.prosody?.acoustic_state ?? null;
        const change = turn.prosody?.acoustic_change ?? null;
        return {
            speaker_id: turn.speaker_id,
            start_ms: turn.start_ms,
            end_ms: turn.end_ms,
            text: turn.text,
            final: true,
            vocal: state ? vocalFeaturesFromState(state, change) : null,
        };
    }
}
export function vocalFeaturesFromWindow(window) {
    return vocalFeaturesFromState(window.getAcousticState(), window.getAcousticChange());
}
export function vocalFeaturesFromState(state, change) {
    if (!state?.values)
        return null;
    const v = state.values;
    return {
        rms_dbfs: finiteOrNull(v.rms_dbfs),
        peak_dbfs: finiteOrNull(v.peak_dbfs),
        f0_median_hz: finiteOrNull(v.f0_median_hz),
        f0_range_semitones: finiteOrNull(v.f0_range_semitones),
        f0_slope_semitones_per_second: finiteOrNull(v.f0_slope_semitones_per_second),
        spectral_tilt_db_per_octave: finiteOrNull(v.spectral_tilt_db_per_octave),
        voiced_ratio: finiteOrNull(v.voiced_ratio),
        pause_ratio: finiteOrNull(v.pause_ratio),
        clipping_ratio: finiteOrNull(v.clipping_ratio),
        voice_onset_rate_hz: finiteOrNull(v.voice_onset_rate_hz),
        change: change?.values ?? null,
        f0_available: state.masks?.f0_available === true,
    };
}
function normalizeSpeakerId(id) {
    const value = (id ?? '').trim();
    return value || 'unknown';
}
function isKnownSpeaker(id) {
    return normalizeSpeakerId(id) !== 'unknown';
}
function overlapMs(startA, endA, startB, endB) {
    return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}
/** Port of demo `mergeTranscriptUpdateSegments`. */
export function mergeTranscriptUpdateSegments(current, incoming, resultId, isFinal, speechFinal = false) {
    const closesSpeech = isFinal && speechFinal;
    const lastIncomingIndex = incoming.length - 1;
    const nextSegments = incoming.map((segment, index) => ({
        ...segment,
        speaker_id: normalizeSpeakerId(segment.speaker_id),
        result_id: resultId || segment.result_id,
        is_final: isFinal,
        speech_final: closesSpeech && index === lastIncomingIndex,
    }));
    if (!resultId)
        return [...current, ...nextSegments];
    const existingFinal = current.some((segment) => segment.result_id === resultId && segment.is_final);
    if (existingFinal && !isFinal)
        return current;
    const retained = current.filter((segment) => segment.result_id !== resultId);
    if (!nextSegments.length && closesSpeech && retained.length) {
        const withEndpoint = [...retained];
        withEndpoint[withEndpoint.length - 1] = {
            ...withEndpoint[withEndpoint.length - 1],
            speech_final: true,
        };
        return withEndpoint;
    }
    return [...retained, ...nextSegments];
}
function resolveLiveSpeakers(segments, steps) {
    if (!segments.length)
        return segments;
    const resolved = segments.map((segment) => ({
        ...segment,
        speaker_id: normalizeSpeakerId(segment.speaker_id),
    }));
    for (const segment of resolved) {
        if (isKnownSpeaker(segment.speaker_id))
            continue;
        const segEnd = Math.max(segment.start_ms + 1, segment.end_ms);
        const overlapBySpeaker = new Map();
        for (const step of steps) {
            const speaker = normalizeSpeakerId(step.speaker_id);
            if (!isKnownSpeaker(speaker))
                continue;
            const overlap = overlapMs(segment.start_ms, segEnd, step.timestamp_ms, step.timestamp_ms + 1000);
            if (overlap > 0) {
                overlapBySpeaker.set(speaker, (overlapBySpeaker.get(speaker) ?? 0) + overlap);
            }
        }
        let bestId = 'unknown';
        let bestOverlap = 0;
        for (const [speaker, overlap] of overlapBySpeaker) {
            if (overlap > bestOverlap) {
                bestOverlap = overlap;
                bestId = speaker;
            }
        }
        if (bestOverlap > 0)
            segment.speaker_id = bestId;
    }
    for (let index = 0; index < resolved.length;) {
        if (isKnownSpeaker(resolved[index].speaker_id)) {
            index += 1;
            continue;
        }
        const runStart = index;
        while (index < resolved.length && !isKnownSpeaker(resolved[index].speaker_id)) {
            index += 1;
        }
        const left = resolved[runStart - 1];
        const right = resolved[index];
        const leftId = left ? normalizeSpeakerId(left.speaker_id) : 'unknown';
        const rightId = right ? normalizeSpeakerId(right.speaker_id) : 'unknown';
        const canBridge = (left?.is_final === true
            && right?.is_final === true
            && isKnownSpeaker(leftId)
            && leftId === rightId
            && resolved.slice(runStart, index).every((segment) => segment.is_final === true));
        if (canBridge) {
            for (let unknownIndex = runStart; unknownIndex < index; unknownIndex += 1) {
                resolved[unknownIndex].speaker_id = leftId;
            }
        }
    }
    return resolved;
}
/** Port of demo `buildTurnsFromSegments` — speaker_id owns cuts; attach vocal. */
export function buildTurnsFromSegments(segments, steps) {
    const sorted = resolveLiveSpeakers(segments, steps)
        .map((segment) => ({ ...segment }))
        .sort((a, b) => a.start_ms - b.start_ms || a.end_ms - b.end_ms);
    const vocalAt = (startMs, endMs) => {
        let best = null;
        let bestOverlap = 0;
        for (const step of steps) {
            const overlap = overlapMs(startMs, endMs, step.timestamp_ms, step.timestamp_ms + 1000);
            if (overlap > bestOverlap) {
                bestOverlap = overlap;
                best = step;
            }
        }
        if (!best?.acoustic_state)
            return null;
        return vocalFeaturesFromState(best.acoustic_state, best.acoustic_change);
    };
    const turns = [];
    for (const seg of sorted) {
        const text = seg.text.trim();
        if (!text)
            continue;
        const speakerId = normalizeSpeakerId(seg.speaker_id);
        const last = turns[turns.length - 1];
        const speakerChanged = Boolean(last && last.speaker_id !== speakerId);
        const unknownInterim = seg.is_final === false && !isKnownSpeaker(speakerId);
        const shouldStartNew = !last || (speakerChanged && !unknownInterim);
        if (!shouldStartNew && last) {
            last.text = `${last.text} ${text}`.trim();
            last.end_ms = Math.max(last.end_ms, seg.end_ms);
            last.final = seg.is_final === true;
            if (!last.vocal)
                last.vocal = vocalAt(last.start_ms, last.end_ms);
            continue;
        }
        turns.push({
            speaker_id: speakerId,
            start_ms: seg.start_ms,
            end_ms: seg.end_ms,
            text,
            final: seg.is_final === true,
            vocal: vocalAt(seg.start_ms, Math.max(seg.start_ms + 1, seg.end_ms)),
        });
    }
    return turns;
}
function finiteOrNull(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
