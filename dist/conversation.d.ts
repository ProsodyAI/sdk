import type { AnalysisResult, DiarizedSpeaker, ProsodyEvent } from './types.js';
import { AcousticWindow, type AcousticFeatureName } from './step.js';
import { type AcousticDeltaPoint, type AcousticFeaturePoint } from './analysis.js';
import { type ConversationTurn } from './conversation/turn-model.js';
import { type VocalFeatures } from './conversation/vocal-features.js';
export type { ConversationTurn } from './conversation/turn-model.js';
export { vocalFeaturesFromState, vocalFeaturesFromWindow, type VocalFeatures, } from './conversation/vocal-features.js';
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
     * Vocal features for a turn (overlap-weighted best step) or latest step.
     * Pass `turnIndex` for a turn; omit for the most recent recurrent step.
     */
    getVocalFeatures(turnIndex?: number): VocalFeatures | null;
    getSpeakers(): DiarizedSpeaker[];
    /** All measured windows, optionally limited to one recording-local speaker. */
    getAcoustics(speakerId?: string): AcousticWindow[];
    getAcousticWindow(index: number): AcousticWindow | null;
    getFeatureSeries(name: AcousticFeatureName, speakerId?: string): AcousticFeaturePoint[];
    getDeltas(speakerId?: string): AcousticDeltaPoint[];
    private batchTurn;
}
