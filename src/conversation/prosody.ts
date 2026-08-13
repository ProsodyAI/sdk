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
export type MeasurementName =
  | 'loudnessDbfs'
  | 'peakDbfs'
  | 'pitchHz'
  | 'pitchRangeSemitones'
  | 'pitchSlopeSemitonesPerSecond'
  | 'tiltDbPerOctave'
  | 'voicedRatio'
  | 'pauseRatio'
  | 'clippingRatio'
  | 'voiceOnsetRateHz';

const MEASUREMENT_WIRE: Record<MeasurementName, string> = {
  loudnessDbfs: 'rms_dbfs',
  peakDbfs: 'peak_dbfs',
  pitchHz: 'f0_median_hz',
  pitchRangeSemitones: 'f0_range_semitones',
  pitchSlopeSemitonesPerSecond: 'f0_slope_semitones_per_second',
  tiltDbPerOctave: 'spectral_tilt_db_per_octave',
  voicedRatio: 'voiced_ratio',
  pauseRatio: 'pause_ratio',
  clippingRatio: 'clipping_ratio',
  voiceOnsetRateHz: 'voice_onset_rate_hz',
};

const CHANGE_WIRE: Record<keyof ProsodyChange, string> = {
  loudnessDb: 'rms_db_change',
  peakDb: 'peak_db_change',
  pitchSemitones: 'f0_median_semitone_change',
  pitchRangeSemitones: 'f0_range_semitone_change',
  pitchSlopeSemitonesPerSecond: 'f0_slope_semitones_per_second_change',
  tiltDbPerOctave: 'spectral_tilt_db_per_octave_change',
  voicedRatio: 'voiced_ratio_change',
  pauseRatio: 'pause_ratio_change',
  voiceOnsetRateHz: 'voice_onset_rate_hz_change',
};

function numberOf(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Read one measurement from a wire acoustic state. */
export function measurementFromState(
  state: AcousticState | null | undefined,
  name: MeasurementName,
): number | null {
  return numberOf(state?.values?.[MEASUREMENT_WIRE[name]]);
}

/** Map wire change values onto the readable change shape. */
export function prosodyChangeFromWire(
  values: AcousticChange['values'] | null | undefined,
): ProsodyChange | null {
  if (!values) return null;
  const change = {} as ProsodyChange;
  for (const [name, wire] of Object.entries(CHANGE_WIRE) as [keyof ProsodyChange, string][]) {
    change[name] = numberOf(values[wire]);
  }
  return change;
}

/** Map a wire acoustic change to a readable delta with its reference. */
export function prosodyDeltaFromWire(
  change: AcousticChange | null | undefined,
): ProsodyDelta | null {
  const values = prosodyChangeFromWire(change?.values);
  if (!values) return null;
  return { reference: change?.reference ?? null, values };
}

/** Map a wire acoustic state onto the named, unit-carrying product shape. */
export function prosodyFromState(
  state: AcousticState | null | undefined,
  change?: AcousticChange | null,
): Prosody | null {
  if (!state) return null;
  const pitchAvailable = state.masks?.f0_available === true;
  return {
    loudnessDbfs: measurementFromState(state, 'loudnessDbfs'),
    peakDbfs: measurementFromState(state, 'peakDbfs'),
    pitchHz: pitchAvailable ? measurementFromState(state, 'pitchHz') : null,
    pitchRangeSemitones: pitchAvailable ? measurementFromState(state, 'pitchRangeSemitones') : null,
    pitchSlopeSemitonesPerSecond: pitchAvailable
      ? measurementFromState(state, 'pitchSlopeSemitonesPerSecond')
      : null,
    tiltDbPerOctave: measurementFromState(state, 'tiltDbPerOctave'),
    voicedRatio: measurementFromState(state, 'voicedRatio'),
    pauseRatio: measurementFromState(state, 'pauseRatio'),
    clippingRatio: measurementFromState(state, 'clippingRatio'),
    voiceOnsetRateHz: measurementFromState(state, 'voiceOnsetRateHz'),
    pitchAvailable,
    change: prosodyChangeFromWire(change?.values ?? null),
  };
}

export function prosodyFromWindow(window: AcousticWindow): Prosody | null {
  return prosodyFromState(window.getAcousticState(), window.getAcousticChange());
}
