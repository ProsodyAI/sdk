import type { AcousticChange, AcousticState } from './acoustic.js';
import type { DiarizationResult, PerSpeakerAnalysis } from './diarization.js';
/** The affect readout on a batch analysis (wire `ProsodyFeatures`). */
export interface ProsodyFeatures {
    /** Vocal tone: -1 (negative) to +1 (positive). Null on an unvoiced frame. */
    valence: number | null;
    /** Activation: 0 (calm) to 1 (activated). Null on an unvoiced frame. */
    arousal: number | null;
    /** Assertiveness: 0 (submissive) to 1 (dominant). Null on an unvoiced frame. */
    dominance: number | null;
    /** The trained acoustic measurement on a voiced span. */
    acoustic_state?: AcousticState | null;
    /** Movement against the speaker's prior measured audio. */
    acoustic_change?: AcousticChange | null;
}
/** Per-turn delivery: the same readout, scoped to one turn's frames. */
export type TurnProsody = ProsodyFeatures;
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
    /** Valence reading. Null on an unvoiced frame. */
    valence: number | null;
    /** Arousal reading. Null on an unvoiced frame. */
    arousal: number | null;
    /** Dominance reading. Null on an unvoiced frame. */
    dominance: number | null;
    /**
     * Per-80ms acoustic trajectory, one row per frame on the codec frame grid.
     * Each row maps feature name to that frame's value; unmeasured frames carry null.
     */
    sequence_frames?: Array<Record<string, number | null>> | null;
    /** What this frame measured. Present on every frame of a diarized call. */
    acoustic_state?: AcousticState | null;
    /** Absent on a speaker's first frame, which has no prior baseline. */
    acoustic_change?: AcousticChange | null;
}
export interface AnalysisTurn {
    start_ms: number;
    end_ms: number;
    speaker_id: string;
    text: string;
    prosody: ProsodyFeatures;
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
} | {
    type: 'entity_span';
    frame_ms: number;
    commit_ms: number;
    duration_ms: number;
    kind: string;
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
    /** Include vocal measurement on transcript turns. Defaults to true. */
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
