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

export function vocalFeaturesFromWindow(window: AcousticWindow): VocalFeatures | null {
  return vocalFeaturesFromState(window.getAcousticState(), window.getAcousticChange());
}

export function vocalFeaturesFromState(
  state: AcousticState | null | undefined,
  change?: AcousticChange | null,
): VocalFeatures | null {
  if (!state?.values) return null;
  const v = state.values;
  return {
    rms_dbfs: finiteOrNull(v.rms_dbfs),
    peak_dbfs: finiteOrNull(v.peak_dbfs),
    f0_median_hz: finiteOrNull(v.f0_median_hz),
    f0_range_semitones: finiteOrNull(v.f0_range_semitones),
    f0_slope_semitones_per_second: finiteOrNull(v.f0_slope_semitones_per_second),
    spectral_tilt_db_per_octave: finiteOrNull(v.spectral_tilt_db_per_octave),
    voiced_ratio: finiteOrNull(v.voiced_ratio),
    pause_ratio: finiteOrNull(v.pause_ratio),
    clipping_ratio: finiteOrNull(v.clipping_ratio),
    voice_onset_rate_hz: finiteOrNull(v.voice_onset_rate_hz),
    change: change?.values ?? null,
    f0_available: state.masks?.f0_available === true,
  };
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
