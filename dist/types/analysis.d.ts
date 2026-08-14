import type { AcousticChange, AcousticState } from './acoustic.js';
import type { DiarizationResult, PerSpeakerAnalysis } from './diarization.js';
/**
 * The affect head's readout on a batch analysis (wire `ProsodyFeatures`).
 * A dimension is `null` when the head did not measure; `affect_available`
 * on the result marks the readings as trained measurements.
 */
export interface ProsodyFeatures {
    /** Vocal tone: -1 (negative) to +1 (positive). */
    valence: number | null;
    /** Activation: 0 (calm) to 1 (activated). */
    arousal: number | null;
    /** Assertiveness: 0 (submissive) to 1 (dominant). */
    dominance: number | null;
}
export interface ProsodySignals {
    engagement?: number;
    stress?: number;
    certainty?: number;
    rapport?: number;
    empathy?: number;
    tempo?: number;
    intensity?: number;
    expressiveness?: number;
    [signal: string]: number | undefined;
}
/** Per-turn delivery (interview / call review product). */
export interface TurnProsody {
    valence: number;
    arousal: number;
    dominance: number;
    signals?: ProsodySignals | Record<string, number> | null;
    /** The trained measurement for the window covering this turn. */
    acoustic_state?: AcousticState | null;
    acoustic_change?: AcousticChange | null;
}
export interface KPIOutcomeEntry {
    kpi_id: string;
    scalar_value?: number;
    boolean_value?: boolean;
    category_value?: string;
}
export type ProsodyTrajectory = 'rising' | 'declining' | 'stable';
export interface ProsodyTimelinePoint {
    start_ms: number;
    end_ms: number;
    speaker_id?: string;
    valence: number;
    arousal: number;
    dominance: number;
    signals?: Record<string, number> | null;
    sequence_signals?: Record<string, number> | null;
    seq_frame?: Record<string, number | number[]> | null;
    /** What this window measured. Present on every window of a diarized call. */
    acoustic_state?: AcousticState | null;
    /** Absent on a speaker's first window because there is nothing to compare against. */
    acoustic_change?: AcousticChange | null;
}
export interface AnalysisTurn {
    start_ms: number;
    end_ms: number;
    speaker_id: string;
    text: string;
    prosody?: TurnProsody | null;
}
/**
 * One committed conversation event. `frame_ms` is retrodictive: it points at
 * where the evidence began on the model's 80ms frame clock; `commit_ms` is
 * where the decision landed.
 */
export type AnalysisEvent = {
    type: 'turn_boundary';
    frame_ms: number;
    commit_ms: number;
} | {
    type: 'barge_in';
    frame_ms: number;
    commit_ms: number;
    duration_ms: number;
    resolved: boolean;
} | {
    type: 'state_delta';
    frame_ms: number;
    commit_ms: number;
    duration_ms: number;
    magnitude: number;
    resolved: boolean;
};
/** The timing skeleton of a conversation: who holds the floor, and when. */
export interface TurnBoundary {
    speaker_id: string;
    start_ms: number;
    end_ms: number;
}
/**
 * ASR status for one analysis. Prosody is measured from the waveform
 * independently of ASR, so an empty transcript is a partial result.
 */
export interface TranscriptionStatus {
    provider?: string;
    model?: string;
    language?: string;
    word_count?: number;
    /** Present when no speech was transcribed. */
    warning?: string;
    [field: string]: unknown;
}
export interface AnalysisResult {
    prediction_id: string;
    session_id?: string | null;
    text: string;
    prosody: ProsodyFeatures;
    /**
     * Marks `prosody.valence/arousal/dominance` as trained measurements when true.
     */
    affect_available?: boolean;
    /** ASR provider status for this analysis. */
    transcription?: TranscriptionStatus | null;
    timings_ms?: Record<string, number> | null;
    duration: number;
    word_count: number;
    turns?: AnalysisTurn[] | null;
    diarization?: DiarizationResult | null;
    prosody_timeline?: ProsodyTimelinePoint[] | null;
    per_speaker?: PerSpeakerAnalysis[] | null;
    /** Committed conversation events in commit order (80ms frame clock). */
    events?: AnalysisEvent[] | null;
}
export interface AnalysisOptions {
    language?: string;
    sessionId?: string;
    /** Return diarized turns and call-level analysis. Defaults to true. */
    diarize?: boolean;
    /**
     * Include vocal measurement on transcript turns when using
     * {@link ProsodyClient.transcribe}. Defaults to true.
     */
    prosody?: boolean;
}
export interface FeedbackCorrectionOptions {
    predictionId: string;
    correctedValence?: number;
    correctedArousal?: number;
    correctedDominance?: number;
    notes?: string;
}
export interface SessionOutcomeOptions {
    sessionId: string;
    outcomes: KPIOutcomeEntry[];
    notes?: string;
}
export interface PCMOptions extends AnalysisOptions {
    sampleRate?: number;
    channels?: number;
    bitDepth?: number;
}
