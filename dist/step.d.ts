import { type MeasurementName, type Prosody, type ProsodyDelta } from './conversation/prosody.js';
import type { AcousticChange, AcousticState, DirectiveEvent, ProsodyTimelinePoint } from './types.js';
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
    /** Committed per-frame voicing mask at 12.5 Hz. */
    frameVoiced: boolean[] | null;
}
/**
 * One gated ProsodySSM recurrent step, as a consumer sees it.
 *
 * Built from a live `directive` or batch `prosody_timeline` window. Raw Mimi
 * latents and recurrent state tensors remain internal.
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
    /** Wire `acoustic_state` payload, for consumers that parse the wire themselves. */
    getAcousticState(): AcousticState | null;
    /** Wire `acoustic_change` payload, for consumers that parse the wire themselves. */
    getAcousticChange(): AcousticChange | null;
    /** The full measurement bundle for this window, under readable names. */
    getProsody(): Prosody | null;
    /** One measurement from this window, by readable name. */
    getMeasurement(name: MeasurementName): number | null;
    getPitch(): PitchReading;
    /** Convenience: median F0 Hz, or null. */
    getPitchHz(): number | null;
    getLevel(): LevelReading;
    getVoicing(): VoicingReading;
    getTilt(): number | null;
    /**
     * Return V/A/D when the checkpoint marks affect as a trained measurement.
     */
    getVad(): AffectVad | null;
    /** Speaker-relative movement vs the prior window in this speaker's scope. */
    getChange(): ProsodyDelta | null;
}
