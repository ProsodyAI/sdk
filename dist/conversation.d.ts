import type { AcousticState, AcousticChange, AnalysisResult, DiarizedSpeaker, ProsodyEvent, TranscriptUpdateSegment } from './types.js';
import { AcousticWindow, type AcousticFeatureName } from './step.js';
import { type AcousticDeltaPoint, type AcousticFeaturePoint } from './analysis.js';
/** Gated vocal measurements from `acoustic_state.values`. */
export interface VocalFeatures {
    rms_dbfs: number | null;
    peak_dbfs: number | null;
    f0_median_hz: number | null;
    f0_range_semitones: number | null;
    f0_slope_semitones_per_second: number | null;
    spectral_tilt_db_per_octave: number | null;
    voiced_ratio: number | null;
    pause_ratio: number | null;
    clipping_ratio: number | null;
    voice_onset_rate_hz: number | null;
    /** Speaker-relative deltas; null on first window for that speaker. */
    change: AcousticChange['values'] | null;
    f0_available: boolean;
}
/** One diarized transcript turn with the covering acoustic measurement. */
export interface ConversationTurn {
    speaker_id: string;
    start_ms: number;
    end_ms: number;
    text: string;
    final?: boolean;
    vocal?: VocalFeatures | null;
}
type LiveSegment = TranscriptUpdateSegment & {
    speech_final?: boolean;
    is_final?: boolean;
};
type StepAnchor = {
    speaker_id: string;
    timestamp_ms: number;
    acoustic_state: AcousticState | null;
    acoustic_change: AcousticChange | null;
};
/**
 * Developer product object for diarized turns and vocal measurements.
 *
 * Live: feed Prosody wire events via `apply`. Batch: `Conversation.fromAnalysis`.
 * Logic mirrors the demo transcript merge and turn builder so the SDK and demo
 * share one conversation spine.
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
export declare function vocalFeaturesFromWindow(window: AcousticWindow): VocalFeatures | null;
export declare function vocalFeaturesFromState(state: AcousticState | null | undefined, change?: AcousticChange | null): VocalFeatures | null;
/** Port of demo `mergeTranscriptUpdateSegments`. */
export declare function mergeTranscriptUpdateSegments(current: LiveSegment[], incoming: TranscriptUpdateSegment[], resultId: string, isFinal: boolean, speechFinal?: boolean): LiveSegment[];
/** Port of demo `buildTurnsFromSegments` — speaker_id owns cuts; attach vocal. */
export declare function buildTurnsFromSegments(segments: LiveSegment[], steps: StepAnchor[]): ConversationTurn[];
export {};
