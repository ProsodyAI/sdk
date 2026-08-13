import type { AnalysisResult, DiarizedSpeaker, ProsodyEvent } from './types.js';
import { AcousticWindow } from './step.js';
import { type ChangePoint, type MeasurementPoint } from './analysis.js';
import { type ConversationTurn } from './conversation/turn-model.js';
import { type MeasurementName, type Prosody } from './conversation/prosody.js';
export type { ConversationTurn } from './conversation/turn-model.js';
export { prosodyFromState, prosodyFromWindow, type MeasurementName, type Prosody, type ProsodyChange, type ProsodyDelta, } from './conversation/prosody.js';
export { applySpeakerUpdateToSegments, mergeTranscriptUpdateSegments, } from './conversation/transcript-merge.js';
export { buildTurnsFromSegments } from './conversation/turn-builder.js';
/**
 * Developer product object for diarized turns and vocal measurements.
 *
 * Live: feed Prosody wire events via `apply` (same spine as the demo session
 * hook). Batch: `Conversation.fromAnalysis`.
 */
export declare class Conversation {
    private segments;
    private steps;
    private affectAvailable;
    private batch;
    static fromAnalysis(result: AnalysisResult): Conversation;
    /** Ingest one live Prosody event (`directive`, `transcript_update`, …). */
    apply(event: ProsodyEvent | Record<string, unknown>): this;
    getTranscript(): string;
    /** Diarized transcript turns with speaker_id (demo-equivalent spine). */
    getTurns(): ConversationTurn[];
    getTurn(index: number): ConversationTurn | null;
    /**
     * Measurement bundle for a turn (overlap-weighted best step) or latest step.
     * Pass `turnIndex` for a turn; omit for the most recent recurrent step.
     */
    getProsody(turnIndex?: number): Prosody | null;
    getSpeakers(): DiarizedSpeaker[];
    /** All measured windows, optionally limited to one recording-local speaker. */
    getAcoustics(speakerId?: string): AcousticWindow[];
    getAcousticWindow(index: number): AcousticWindow | null;
    getMeasurementSeries(name: MeasurementName, speakerId?: string): MeasurementPoint[];
    /** Speaker-relative changes. The first window in each speaker lane has none. */
    getChanges(speakerId?: string): ChangePoint[];
    private batchTurn;
}
