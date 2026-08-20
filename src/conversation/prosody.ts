import type { VoiceFrame } from '../step.js';
import type { AcousticChange, AcousticState } from '../types.js';

/** Intonation: the F0 contour of one frame. */
export interface IntonationState {
  /** Median F0, Hz. Null when the frame was unvoiced. */
  pitch: number | null;
  /** F0 span within the frame, semitones. F0 span marks emphasis. */
  range: number | null;
  /** Contour direction, semitones per second: negative falls, positive rises. */
  slope: number | null;
}

/** Stress: the loudness of one frame. */
export interface StressState {
  /** Loudness, dBFS relative to full scale. */
  loudness: number | null;
  /** Peak loudness in the frame, dBFS. */
  peak: number | null;
}

/** Rhythm: the timing of phonation and silence in one frame. */
export interface RhythmState {
  /** Fraction of the frame phonated, 0-1. */
  voiced: number | null;
  /** Fraction of the frame in silence, 0-1. */
  pause: number | null;
  /** Phonation onsets per second; correlates with articulation rate. */
  onset: number | null;
}

/**
 * The suprasegmental readout of one frame: intonation, stress, rhythm, and
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
  /** F0 span movement, semitones. */
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
 * What one frame moved, field by field with `ProsodyState`. Signed: zero is
 * a real reading, `null` means the measurement was not supported.
 */
export interface ProsodyChange {
  intonation: IntonationChange;
  stress: StressChange;
  rhythm: RhythmChange;
  tilt: number | null;
}

/** One frame of prosody: what was measured, and what it moved. */
export interface Prosody {
  state: ProsodyState;
  /** Speaker-relative movement. Null on the speaker's first frame. */
  change: ProsodyChange | null;
}

/** One committed change with the baseline it was judged against. */
export interface ProsodyDelta {
  reference: string | null;
  values: ProsodyChange;
}

/** Wire keys for the measured state, declared once in family shape. */
const STATE_WIRE = {
  intonation: {
    pitch: 'f0_median_hz',
    range: 'f0_range_semitones',
    slope: 'f0_slope_semitones_per_second',
  },
  stress: {
    loudness: 'rms_dbfs',
    peak: 'peak_dbfs',
  },
  rhythm: {
    voiced: 'voiced_ratio',
    pause: 'pause_ratio',
    onset: 'voice_onset_rate_hz',
  },
  tilt: 'spectral_tilt_db_per_octave',
  clipping: 'clipping_ratio',
} as const;

/** Wire keys for speaker-relative movement, same family shape. */
const CHANGE_WIRE = {
  intonation: {
    pitch: 'f0_median_semitone_change',
    range: 'f0_range_semitone_change',
    slope: 'f0_slope_semitones_per_second_change',
  },
  stress: {
    loudness: 'rms_db_change',
    peak: 'peak_db_change',
  },
  rhythm: {
    voiced: 'voiced_ratio_change',
    pause: 'pause_ratio_change',
    onset: 'voice_onset_rate_hz_change',
  },
  tilt: 'spectral_tilt_db_per_octave_change',
} as const;

/** Typed measurement paths accepted by the series accessors. */
export type MeasurementPath =
  | `intonation.${keyof typeof STATE_WIRE.intonation}`
  | `stress.${keyof typeof STATE_WIRE.stress}`
  | `rhythm.${keyof typeof STATE_WIRE.rhythm}`
  | 'tilt'
  | 'clipping';

function flattenWire(registry: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, node] of Object.entries(registry)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof node === 'string') out[path] = node;
    else Object.assign(out, flattenWire(node as Record<string, unknown>, path));
  }
  return out;
}

const STATE_WIRE_FLAT = flattenWire(STATE_WIRE) as Record<MeasurementPath, string>;

function buildFromWire<T>(
  registry: Record<string, unknown> | string,
  read: (wireKey: string) => number | null,
): T {
  if (typeof registry === 'string') return read(registry) as T;
  const out: Record<string, unknown> = {};
  for (const [key, node] of Object.entries(registry)) {
    out[key] = buildFromWire(node as Record<string, unknown> | string, read);
  }
  return out as T;
}

function numberOf(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Map a wire acoustic state onto the measured frame. Intonation reads null
 * when the frame was unvoiced: F0 does not exist on unphonated audio.
 */
export function prosodyStateFromWire(state: AcousticState | null | undefined): ProsodyState | null {
  if (!state) return null;
  const built = buildFromWire<ProsodyState>(STATE_WIRE, (key) => numberOf(state.values?.[key]));
  if (state.masks?.f0_available !== true) {
    built.intonation = { pitch: null, range: null, slope: null };
  }
  return built;
}

/** Read one measurement from a wire acoustic state, by typed path. */
export function measurementFromState(
  state: AcousticState | null | undefined,
  path: MeasurementPath,
): number | null {
  if (!state) return null;
  if (path.startsWith('intonation.') && state.masks?.f0_available !== true) return null;
  return numberOf(state.values?.[STATE_WIRE_FLAT[path]]);
}

/** Map wire change values onto the family-shaped movement. */
export function prosodyChangeFromWire(
  values: AcousticChange['values'] | null | undefined,
): ProsodyChange | null {
  if (!values) return null;
  return buildFromWire<ProsodyChange>(CHANGE_WIRE, (key) => numberOf(values[key]));
}

/** Map a wire acoustic change to a delta with its reference. */
export function prosodyDeltaFromWire(
  change: AcousticChange | null | undefined,
): ProsodyDelta | null {
  const values = prosodyChangeFromWire(change?.values);
  if (!values) return null;
  return { reference: change?.reference ?? null, values };
}

/** Map a wire acoustic state onto the product shape: state plus movement. */
export function prosodyFromState(
  state: AcousticState | null | undefined,
  change?: AcousticChange | null,
): Prosody | null {
  const built = prosodyStateFromWire(state);
  if (!built) return null;
  return { state: built, change: prosodyChangeFromWire(change?.values ?? null) };
}

export function prosodyFromFrame(frame: VoiceFrame): Prosody | null {
  return prosodyFromState(frame.getAcousticState(), frame.getAcousticChange());
}
