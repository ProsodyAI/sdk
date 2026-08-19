import type { AnalysisResult, DiarizedSpeaker, ProsodyEvent } from './types.js';
import { VoiceFrame, type AffectVad } from './step.js';
import { type ChangePoint, type MeasurementPoint } from './analysis.js';
import { type ConversationTurn } from './conversation/turn-model.js';
import { type MeasurementPath, type Prosody } from './conversation/prosody.js';
import { type Moment } from './conversation/moments.js';
export type { ConversationTurn } from './conversation/turn-model.js';
export { prosodyFromState, prosodyFromWindow, type MeasurementPath, type Prosody, type ProsodyChange, type ProsodyDelta, type ProsodyState, } from './conversation/prosody.js';
export { applySpeakerUpdateToSegments, mergeTranscriptUpdateSegments, } from './conversation/transcript-merge.js';
export { buildTurnsFromSegments } from './conversation/turn-builder.js';
export { byMagnitude, type Moment } from './conversation/moments.js';
/**
 * Shared state model for diarized turns and voice measurements, over a
 * recording or a live socket.
 *
 * Live: feed Prosody wire events via `apply`. Batch: build from
 * `Conversation.fromAnalysis`. The same object backs `LiveSession` and the
 * batch `Transcription.conversation`.
 */
export declare class Conversation {
    private segments;
    private steps;
    private deltas;
    private batch;
    /** Build a conversation from a batch analysis result. */
    static fromAnalysis(result: AnalysisResult): Conversation;
    /** Ingest one live Prosody event (`directive`, `transcript_update`, …). */
    apply(event: ProsodyEvent | Record<string, unknown>): this;
    /** Full transcript text, built from the current turns. */
    getTranscript(): string;
    /** Diarized turns with speaker ids and attached prosody. */
    getTurns(): ConversationTurn[];
    /** One turn by index, or null when out of range. */
    getTurn(index: number): ConversationTurn | null;
    /**
     * Measurement bundle for a turn (overlap-weighted best step) or latest step.
     * Pass `turnIndex` for a turn; omit for the most recent recurrent step.
     */
    getProsody(turnIndex?: number): Prosody | null;
    /** Speakers on this call, with talk time and frame counts. */
    getSpeakers(): DiarizedSpeaker[];
    /** Measured affect for the call. Each component is null on an unvoiced frame. */
    getVad(): AffectVad | null;
    /** All measured frames, optionally limited to one recording-local speaker. */
    getFrames(speakerId?: string): VoiceFrame[];
    /** One frame by index, or null when out of range. */
    getVoiceFrame(index: number): VoiceFrame | null;
    /** One measurement across the call, by typed path, optionally for one speaker. */
    getMeasurementSeries(path: MeasurementPath, speakerId?: string): MeasurementPoint[];
    /** Speaker-relative changes. The first window in each speaker lane has none. */
    getChanges(speakerId?: string): ChangePoint[];
    /**
     * Moments the model committed, in commit order.
     *
     * The batch report carries them on `events`; a live session receives them
     * as `state_delta` on the socket. Both arrive already measured, so the
     * accessor reads the same shape either way.
     */
    getMoments(speakerId?: string): Moment[];
    /** The moments that moved the speaker furthest, largest first. */
    getTopMoments(limit?: number, speakerId?: string): Moment[];
    private batchTurn;
}
