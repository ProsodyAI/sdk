import { AcousticWindow, } from './step.js';
import { ConversationAnalysis, } from './analysis.js';
import { isKnownSpeaker, normalizeSpeakerId, } from './conversation/turn-model.js';
import { vocalFeaturesFromState, vocalFeaturesFromWindow, } from './conversation/vocal-features.js';
import { applySpeakerUpdateToSegments, mergeTranscriptUpdateSegments, } from './conversation/transcript-merge.js';
import { buildTurnsFromSegments } from './conversation/turn-builder.js';
export { vocalFeaturesFromState, vocalFeaturesFromWindow, } from './conversation/vocal-features.js';
export { applySpeakerUpdateToSegments, mergeTranscriptUpdateSegments, } from './conversation/transcript-merge.js';
export { buildTurnsFromSegments } from './conversation/turn-builder.js';
/**
 * Developer product object for diarized turns and vocal measurements.
 *
 * Live: feed Prosody wire events via `apply` (same spine as the demo session
 * hook). Batch: `Conversation.fromAnalysis`.
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
        if (type === 'speaker_update') {
            const update = event;
            const startMs = Number(update.start_ms ?? 0);
            const endMs = Number(update.end_ms ?? startMs);
            const speakerId = normalizeSpeakerId(update.speaker_id ?? update.dominant_speaker_id ?? 'unknown');
            this.steps = this.steps.map((step) => {
                if (step.timestamp_ms >= endMs || step.timestamp_ms + 1000 <= startMs) {
                    return step;
                }
                const existing = normalizeSpeakerId(step.speaker_id);
                if (speakerId === 'unknown' || existing !== 'unknown')
                    return step;
                return { ...step, speaker_id: speakerId };
            });
            if (isKnownSpeaker(speakerId)) {
                this.segments = applySpeakerUpdateToSegments(this.segments, startMs, endMs, speakerId);
            }
            return this;
        }
        if (type === 'session_end') {
            const end = event;
            const turns = end.transcript?.turns ?? [];
            if (turns.length) {
                this.segments = turns.map((turn) => ({
                    start_ms: turn.start_ms,
                    end_ms: turn.end_ms,
                    speaker_id: normalizeSpeakerId(turn.speaker_id),
                    text: turn.text || '',
                    result_id: 'session_end',
                    provider: 'session_end',
                    is_final: true,
                    speech_final: true,
                }));
            }
            const timeline = end.prosody_timeline?.length
                ? end.prosody_timeline
                : end.transcript?.prosody_timeline;
            if (timeline?.length && this.steps.length === 0) {
                for (const point of timeline) {
                    if (!point.acoustic_state)
                        continue;
                    this.steps.push({
                        speaker_id: normalizeSpeakerId(point.speaker_id),
                        timestamp_ms: point.start_ms,
                        acoustic_state: point.acoustic_state,
                        acoustic_change: point.acoustic_change ?? null,
                    });
                }
            }
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
