import type { AcousticChange, AcousticState, AcousticStateFrames, AcousticStateValues, DirectiveEvent, ProsodyTimelinePoint } from './types.js';
export interface AffectVad {
    valence: number;
    arousal: number;
    dominance: number;
}
export interface PitchReading {
    /** Median voiced F0 (Hz). Null when the window was unvoiced. */
    medianHz: number | null;
    rangeSemitones: number | null;
    slopeSemitonesPerSecond: number | null;
    available: boolean;
}
export interface LevelReading {
    rmsDbfs: number | null;
    peakDbfs: number | null;
    clippingRatio: number | null;
}
export interface VoicingReading {
    voicedRatio: number | null;
    pauseRatio: number | null;
    onsetRateHz: number | null;
    /** Per-frame voiced probabilities @ 12.5 Hz when the step included frames. */
    frameVoicedProbability: number[] | null;
}
export type AcousticFeatureName = 'rms_dbfs' | 'peak_dbfs' | 'f0_median_hz' | 'f0_range_semitones' | 'f0_slope_semitones_per_second' | 'spectral_tilt_db_per_octave' | 'voiced_ratio' | 'pause_ratio' | 'clipping_ratio' | 'voice_onset_rate_hz';
export type AcousticDeltaName = 'rms_db_change' | 'peak_db_change' | 'f0_median_semitone_change' | 'f0_range_semitone_change' | 'f0_slope_semitones_per_second_change' | 'spectral_tilt_db_per_octave_change' | 'voiced_ratio_change' | 'pause_ratio_change' | 'voice_onset_rate_hz_change';
export type AcousticFrameName = 'rms_dbfs' | 'f0_hz' | 'spectral_tilt_db_per_octave' | 'voiced_probability' | 'voice_activity_boundary_probability';
export interface AcousticFramePoint {
    timeMs: number;
    value: number | null;
}
/**
 * One gated ProsodySSM recurrent step, as a consumer sees it.
 *
 * Backed by live `directive` or a batch `prosody_timeline` window — not by
 * inventing fields. Raw Mimi latents and recurrent state tensors stay off this
 * object.
 */
export declare class AcousticWindow {
    readonly speakerId: string;
    readonly timestampMs: number;
    readonly startMs: number;
    readonly endMs: number;
    readonly affectAvailable: boolean;
    private readonly state;
    private readonly change;
    private readonly affect;
    private constructor();
    /** Live analysis chunk (`directive` from `/v1/stream/realtime`). */
    static fromDirective(event: DirectiveEvent): AcousticWindow;
    /** One diarized batch window from `prosody_timeline`. */
    static fromTimelinePoint(point: ProsodyTimelinePoint, options?: {
        affectAvailable?: boolean;
    }): AcousticWindow;
    /** Live step without requiring a full directive payload. */
    static fromLiveStep(args: {
        speakerId: string;
        timestampMs: number;
        acousticState: AcousticState | null;
        acousticChange?: AcousticChange | null;
        affectAvailable?: boolean;
    }): AcousticWindow;
    getSpeakerId(): string;
    /** Full gated `acoustic_state` object (values / masks / frames). */
    getAcousticState(): AcousticState | null;
    getAcousticChange(): AcousticChange | null;
    getValues(): AcousticStateValues | null;
    getFrames(): AcousticStateFrames | null;
    getFeature(name: AcousticFeatureName): number | null;
    getDelta(name: AcousticDeltaName): number | null;
    /** Mimi-aligned frame trajectory for live windows. Batch reports omit frames. */
    getFrameSeries(name: AcousticFrameName): AcousticFramePoint[];
    getPitch(): PitchReading;
    /** Convenience: median F0 Hz, or null. */
    getPitchHz(): number | null;
    getLevel(): LevelReading;
    getVoicing(): VoicingReading;
    getTilt(): number | null;
    /**
     * Affect VAD only when the checkpoint says it is a measurement.
     * Never treat defaults as product when `affectAvailable` is false.
     */
    getVad(): AffectVad | null;
    /** Speaker-relative deltas vs prior chunk in this speaker's recurrent scope. */
    getChange(): AcousticChange['values'] | null;
    /** Bob-facing bundle of gated vocal measurements for this step. */
    getVocalFeatures(): {
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
        change: AcousticChange['values'] | null;
        f0_available: boolean;
    } | null;
}
/** @deprecated Use AcousticWindow. */
export { AcousticWindow as RecurrentStep };
