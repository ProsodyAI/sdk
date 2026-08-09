import type { AcousticChange, AcousticState } from '../types.js';
import type { AcousticWindow } from '../step.js';
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
export declare function vocalFeaturesFromWindow(window: AcousticWindow): VocalFeatures | null;
export declare function vocalFeaturesFromState(state: AcousticState | null | undefined, change?: AcousticChange | null): VocalFeatures | null;
