/** Provenance for an acoustic measurement. */
export interface AcousticProvenance {
  kind?: string;
  feature_version?: string;
}

/**
 * Trained physical measurements over one waveform window. A value is `null`
 * when the window cannot support it. Check `masks` before reading.
 */
export interface AcousticStateValues {
  rms_dbfs?: number | null;
  peak_dbfs?: number | null;
  f0_median_hz?: number | null;
  f0_range_semitones?: number | null;
  f0_slope_semitones_per_second?: number | null;
  spectral_tilt_db_per_octave?: number | null;
  voiced_ratio?: number | null;
  pause_ratio?: number | null;
  clipping_ratio?: number | null;
  voice_onset_rate_hz?: number | null;
  tempo_syllables_per_second?: number | null;
  [feature: string]: number | null | undefined;
}

export interface AcousticStateMasks {
  f0_available?: boolean;
  f0_range_available?: boolean;
  f0_slope_available?: boolean;
  spectral_tilt_available?: boolean;
  voiced_mask?: boolean[];
}

/** Per-frame trajectory. Absent in the batch report. */
export interface AcousticStateFrames {
  frame_rate_hz?: number;
  rms_dbfs?: number[];
  /** `null` on unvoiced frames. */
  f0_hz?: (number | null)[];
  spectral_tilt_db_per_octave?: (number | null)[];
}

export interface AcousticState {
  values?: AcousticStateValues;
  masks?: AcousticStateMasks;
  frames?: AcousticStateFrames | null;
  provenance?: AcousticProvenance;
}

/** Signed deltas against the reference window. Zero is a real reading. */
export interface AcousticChangeValues {
  rms_db_change?: number | null;
  peak_db_change?: number | null;
  f0_median_semitone_change?: number | null;
  f0_range_semitone_change?: number | null;
  f0_slope_semitones_per_second_change?: number | null;
  spectral_tilt_db_per_octave_change?: number | null;
  voiced_ratio_change?: number | null;
  pause_ratio_change?: number | null;
  voice_onset_rate_hz_change?: number | null;
  [feature: string]: number | null | undefined;
}

/**
 * Delivery movement against the same speaker's previous measured window.
 */
export interface AcousticChange {
  values?: AcousticChangeValues;
  reference?: string;
  provenance?: AcousticProvenance;
}
