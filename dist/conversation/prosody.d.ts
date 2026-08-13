import type { AcousticWindow } from '../step.js';
import type { AcousticChange, AcousticState } from '../types.js';
/**
 * How a window moved against the same speaker's preceding audio. Signed:
 * zero is a real reading, `null` means the measurement was not supported.
 */
export interface ProsodyChange {
    loudnessDb: number | null;
    peakDb: number | null;
    pitchSemitones: number | null;
    pitchRangeSemitones: number | null;
    pitchSlopeSemitonesPerSecond: number | null;
    tiltDbPerOctave: number | null;
    voicedRatio: number | null;
    pauseRatio: number | null;
    voiceOnsetRateHz: number | null;
}
/**
 * How a window sounded, in physical units.
 *
 * A field is `null` when the audio did not support the measurement (pitch on
 * a whispered or unvoiced window, for example).
 */
export interface Prosody {
    /** Loudness, dBFS. */
    loudnessDbfs: number | null;
    /** Loudest sample in the window, dBFS. */
    peakDbfs: number | null;
    /** Pitch, Hz. */
    pitchHz: number | null;
    /** Pitch movement within the window, semitones. */
    pitchRangeSemitones: number | null;
    /** Pitch direction, semitones per second: negative falls, positive rises. */
    pitchSlopeSemitonesPerSecond: number | null;
    /** Spectral tilt, dB per octave. Breathy voices tilt steeper. */
    tiltDbPerOctave: number | null;
    /** Fraction of the window carrying voiced audio, 0-1. */
    voicedRatio: number | null;
    /** Fraction of the window that was silence, 0-1. */
    pauseRatio: number | null;
    /** Fraction of samples at the clipping ceiling, 0-1. */
    clippingRatio: number | null;
    /** Voice onsets per second: how often phonation restarts. */
    voiceOnsetRateHz: number | null;
    /** True when pitch was measurable on this window. */
    pitchAvailable: boolean;
    /** Change against this speaker's own baseline. `null` on their first window. */
    change: ProsodyChange | null;
}
/** One committed change with the baseline it was judged against. */
export interface ProsodyDelta {
    reference: string | null;
    values: ProsodyChange;
}
/** Readable measurement keys accepted by the series accessors. */
export type MeasurementName = 'loudnessDbfs' | 'peakDbfs' | 'pitchHz' | 'pitchRangeSemitones' | 'pitchSlopeSemitonesPerSecond' | 'tiltDbPerOctave' | 'voicedRatio' | 'pauseRatio' | 'clippingRatio' | 'voiceOnsetRateHz';
/** Read one measurement from a wire acoustic state. */
export declare function measurementFromState(state: AcousticState | null | undefined, name: MeasurementName): number | null;
/** Map wire change values onto the readable change shape. */
export declare function prosodyChangeFromWire(values: AcousticChange['values'] | null | undefined): ProsodyChange | null;
/** Map a wire acoustic change to a readable delta with its reference. */
export declare function prosodyDeltaFromWire(change: AcousticChange | null | undefined): ProsodyDelta | null;
/** Map a wire acoustic state onto the named, unit-carrying product shape. */
export declare function prosodyFromState(state: AcousticState | null | undefined, change?: AcousticChange | null): Prosody | null;
export declare function prosodyFromWindow(window: AcousticWindow): Prosody | null;
