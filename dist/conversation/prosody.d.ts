import type { VoiceFrame } from '../step.js';
import type { AcousticChange, AcousticState } from '../types.js';
/** Intonation: the F0 contour of one window. */
export interface IntonationState {
    /** Median F0, Hz. Null when the window was unvoiced. */
    pitch: number | null;
    /** F0 span within the window, semitones. Pitch span marks emphasis. */
    range: number | null;
    /** Contour direction, semitones per second: negative falls, positive rises. */
    slope: number | null;
}
/** Stress: the intensity of one window. */
export interface StressState {
    /** Intensity, dBFS relative to full scale. */
    loudness: number | null;
    /** Peak intensity in the window, dBFS. */
    peak: number | null;
}
/** Rhythm: the timing of phonation and silence in one window. */
export interface RhythmState {
    /** Fraction of the window phonated, 0-1. */
    voiced: number | null;
    /** Fraction of the window in silence, 0-1. */
    pause: number | null;
    /** Phonation onsets per second; correlates with articulation rate. */
    onset: number | null;
}
/**
 * The suprasegmental readout of one window: intonation, stress, rhythm, and
 * voice quality in physical units.
 */
export interface ProsodyState {
    intonation: IntonationState;
    stress: StressState;
    rhythm: RhythmState;
    /** Voice quality: spectral tilt, dB per octave. Breathy phonation tilts steeper than pressed. */
    tilt: number | null;
    /** Signal health: fraction of samples at full scale, 0-1. */
    clipping: number | null;
}
/** Intonation movement against the speaker's own baseline. */
export interface IntonationChange {
    /** F0 movement, semitones. */
    pitch: number | null;
    /** Pitch span movement, semitones. */
    range: number | null;
    /** Contour movement, semitones per second. */
    slope: number | null;
}
/** Stress movement against the speaker's own baseline. */
export interface StressChange {
    /** Loudness movement, dB. */
    loudness: number | null;
    /** Peak movement, dB. */
    peak: number | null;
}
/** Rhythm movement against the speaker's own baseline. */
export interface RhythmChange {
    voiced: number | null;
    pause: number | null;
    onset: number | null;
}
/**
 * What one window moved, field by field with `ProsodyState`. Signed: zero is
 * a real reading, `null` means the measurement was not supported.
 */
export interface ProsodyChange {
    intonation: IntonationChange;
    stress: StressChange;
    rhythm: RhythmChange;
    tilt: number | null;
}
/** One window of prosody: what was measured, and what it moved. */
export interface Prosody {
    state: ProsodyState;
    /** Speaker-relative movement. Null on the speaker's first window. */
    change: ProsodyChange | null;
}
/** One committed change with the baseline it was judged against. */
export interface ProsodyDelta {
    reference: string | null;
    values: ProsodyChange;
}
/** Wire keys for the measured state, declared once in family shape. */
declare const STATE_WIRE: {
    readonly intonation: {
        readonly pitch: "f0_median_hz";
        readonly range: "f0_range_semitones";
        readonly slope: "f0_slope_semitones_per_second";
    };
    readonly stress: {
        readonly loudness: "rms_dbfs";
        readonly peak: "peak_dbfs";
    };
    readonly rhythm: {
        readonly voiced: "voiced_ratio";
        readonly pause: "pause_ratio";
        readonly onset: "voice_onset_rate_hz";
    };
    readonly tilt: "spectral_tilt_db_per_octave";
    readonly clipping: "clipping_ratio";
};
/** Typed measurement paths accepted by the series accessors. */
export type MeasurementPath = `intonation.${keyof typeof STATE_WIRE.intonation}` | `stress.${keyof typeof STATE_WIRE.stress}` | `rhythm.${keyof typeof STATE_WIRE.rhythm}` | 'tilt' | 'clipping';
/**
 * Map a wire acoustic state onto the measured window. Intonation reads null
 * when the window was unvoiced: pitch does not exist on unphonated audio.
 */
export declare function prosodyStateFromWire(state: AcousticState | null | undefined): ProsodyState | null;
/** Read one measurement from a wire acoustic state, by typed path. */
export declare function measurementFromState(state: AcousticState | null | undefined, path: MeasurementPath): number | null;
/** Map wire change values onto the family-shaped movement. */
export declare function prosodyChangeFromWire(values: AcousticChange['values'] | null | undefined): ProsodyChange | null;
/** Map a wire acoustic change to a delta with its reference. */
export declare function prosodyDeltaFromWire(change: AcousticChange | null | undefined): ProsodyDelta | null;
/** Map a wire acoustic state onto the product shape: state plus movement. */
export declare function prosodyFromState(state: AcousticState | null | undefined, change?: AcousticChange | null): Prosody | null;
export declare function prosodyFromWindow(window: VoiceFrame): Prosody | null;
export {};
