import { VoiceFrame } from './step.js';
import { ConversationAnalysis, } from './analysis.js';
import { isKnownSpeaker, normalizeSpeakerId, } from './conversation/turn-model.js';
import { measurementFromState, prosodyDeltaFromWire, prosodyFromState, prosodyFromFrame, } from './conversation/prosody.js';
import { byMagnitude, momentsFromStateDeltas, } from './conversation/moments.js';
import { applySpeakerUpdateToSegments, mergeTranscriptUpdateSegments, } from './conversation/transcript-merge.js';
import { buildTurnsFromSegments } from './conversation/turn-builder.js';
export { prosodyFromState, prosodyFromFrame, } from './conversation/prosody.js';
export { applySpeakerUpdateToSegments, mergeTranscriptUpdateSegments, } from './conversation/transcript-merge.js';
export { appendTranscriptPiece, buildTurnsFromSegments } from './conversation/turn-builder.js';
export { byMagnitude } from './conversation/moments.js';
/**
 * Shared state model for diarized turns and voice measurements. Live: feed
 * wire events via `apply`. Batch: build from `Conversation.fromAnalysis`.
 */
export class Conversation {
    segments = [];
    steps = [];
    deltas = [];
    turnBoundaries = [];
    batch = null;
    /** Build a conversation from a batch analysis result. */
    static fromAnalysis(result) {
        const conversation = new Conversation();
        conversation.batch = new ConversationAnalysis(result);
        return conversation;
    }
    /** Ingest one live Prosody event (`directive`, `transcript_update`, …). */
    apply(event) {
        const type = String(event.type ?? '');
        if (type === 'directive') {
            const directive = event;
            this.steps.push({
                speaker_id: normalizeSpeakerId(directive.speaker_id),
                timestamp_ms: directive.timestamp_ms,
                acoustic_state: directive.acoustic_state ?? null,
                acoustic_change: directive.acoustic_change ?? null,
            });
            return this;
        }
        if (type === 'state_delta') {
            this.deltas.push(event);
            return this;
        }
        if (type === 'turn_boundary') {
            const frameMs = Number(event.frame_ms);
            if (Number.isFinite(frameMs) && !this.turnBoundaries.includes(frameMs)) {
                this.turnBoundaries = [...this.turnBoundaries, frameMs].sort((a, b) => a - b);
            }
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
    /** Full transcript text, built from the current turns. */
    getTranscript() {
        if (this.batch)
            return this.batch.getTranscript();
        return this.getTurns().map((turn) => turn.text).join(' ').trim();
    }
    /** Diarized turns with speaker ids and attached prosody. */
    getTurns() {
        if (this.batch) {
            return this.batch.getTurns().map((turn) => this.batchTurn(turn));
        }
        return buildTurnsFromSegments(this.segments, this.steps, this.turnBoundaries);
    }
    /** One turn by index, or null when out of range. */
    getTurn(index) {
        const turns = this.getTurns();
        if (!Number.isInteger(index) || index < 0 || index >= turns.length)
            return null;
        return turns[index] ?? null;
    }
    /** Measurement bundle for a turn (`turnIndex`) or the most recent recurrent step. */
    getProsody(turnIndex) {
        if (turnIndex !== undefined) {
            const turn = this.getTurn(turnIndex);
            return turn?.prosody ?? null;
        }
        if (this.batch) {
            const frames = this.batch.getFrames();
            const last = frames[frames.length - 1];
            return last ? prosodyFromFrame(last) : null;
        }
        const last = this.steps[this.steps.length - 1];
        if (!last?.acoustic_state)
            return null;
        return prosodyFromState(last.acoustic_state, last.acoustic_change);
    }
    /** Speakers on this call, with talk time and frame counts. */
    getSpeakers() {
        if (this.batch)
            return this.batch.getSpeakers();
        const turns = this.getTurns();
        const frames = this.getFrames();
        const ids = new Set();
        for (const turn of turns)
            if (isKnownSpeaker(turn.speaker_id))
                ids.add(turn.speaker_id);
        for (const frame of frames)
            if (isKnownSpeaker(frame.speakerId))
                ids.add(frame.speakerId);
        return [...ids].map((speakerId) => ({
            speaker_id: speakerId,
            talk_ms: turns
                .filter((turn) => turn.speaker_id === speakerId)
                .reduce((total, turn) => total + Math.max(0, turn.end_ms - turn.start_ms), 0),
            turn_count: turns.filter((turn) => turn.speaker_id === speakerId).length,
            window_count: frames.filter((frame) => frame.speakerId === speakerId).length,
        }));
    }
    /** Measured affect for the call. Each component is null on an unvoiced frame. */
    getVad() {
        if (this.batch)
            return this.batch.getVad();
        const frames = this.getFrames();
        const last = frames[frames.length - 1];
        return last?.vad ?? null;
    }
    /** All measured frames, optionally limited to one recording-local speaker. */
    getFrames(speakerId) {
        if (this.batch)
            return this.batch.getFrames(speakerId);
        return this.steps.map((step) => VoiceFrame.fromLiveStep({
            speakerId: step.speaker_id,
            timestampMs: step.timestamp_ms,
            acousticState: step.acoustic_state,
            acousticChange: step.acoustic_change,
        })).filter((frame) => speakerId === undefined || frame.speakerId === speakerId);
    }
    /** One frame by index, or null when out of range. */
    getVoiceFrame(index) {
        const frames = this.getFrames();
        if (!Number.isInteger(index) || index < 0 || index >= frames.length)
            return null;
        return frames[index] ?? null;
    }
    /** One measurement across the call, by typed path, optionally for one speaker. */
    getMeasurementSeries(path, speakerId) {
        if (this.batch)
            return this.batch.getMeasurementSeries(path, speakerId);
        return this.getFrames(speakerId).flatMap((frame) => {
            const value = measurementFromState(frame.getAcousticState(), path);
            return value === null ? [] : [{
                    startMs: frame.startMs,
                    endMs: frame.endMs,
                    speakerId: frame.speakerId,
                    value,
                }];
        });
    }
    /** Speaker-relative changes. The first frame in each speaker lane has none. */
    getChanges(speakerId) {
        if (this.batch)
            return this.batch.getChanges(speakerId);
        return this.getFrames(speakerId).flatMap((frame) => {
            const delta = prosodyDeltaFromWire(frame.getAcousticChange());
            if (!delta)
                return [];
            return [{
                    startMs: frame.startMs,
                    endMs: frame.endMs,
                    speakerId: frame.speakerId,
                    reference: delta.reference,
                    values: delta.values,
                }];
        });
    }
    /** Moments the model committed, in commit order. */
    getMoments(speakerId) {
        if (this.batch)
            return this.batch.getMoments(speakerId);
        return momentsFromStateDeltas(this.deltas, this.getTurns()).filter((moment) => speakerId === undefined || moment.speakerId === speakerId);
    }
    /** The moments that moved the speaker furthest, largest first. */
    getTopMoments(limit = 10, speakerId) {
        return byMagnitude(this.getMoments(speakerId)).slice(0, Math.max(0, limit));
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
            prosody: state ? prosodyFromState(state, change) : null,
        };
    }
}
