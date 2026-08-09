import type {
  AcousticChange,
  AcousticState,
  AcousticStateFrames,
  AcousticStateValues,
  DirectiveEvent,
  ProsodyTimelinePoint,
} from './types.js';

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

export type AcousticFeatureName =
  | 'rms_dbfs'
  | 'peak_dbfs'
  | 'f0_median_hz'
  | 'f0_range_semitones'
  | 'f0_slope_semitones_per_second'
  | 'spectral_tilt_db_per_octave'
  | 'voiced_ratio'
  | 'pause_ratio'
  | 'clipping_ratio'
  | 'voice_onset_rate_hz';

export type AcousticDeltaName =
  | 'rms_db_change'
  | 'peak_db_change'
  | 'f0_median_semitone_change'
  | 'f0_range_semitone_change'
  | 'f0_slope_semitones_per_second_change'
  | 'spectral_tilt_db_per_octave_change'
  | 'voiced_ratio_change'
  | 'pause_ratio_change'
  | 'voice_onset_rate_hz_change';

export type AcousticFrameName =
  | 'rms_dbfs'
  | 'f0_hz'
  | 'spectral_tilt_db_per_octave';

export interface AcousticFramePoint {
  timeMs: number;
  value: number | null;
}

/**
 * One gated ProsodySSM recurrent step, as a consumer sees it.
 *
 * Built from a live `directive` or batch `prosody_timeline` window. Raw Mimi
 * latents and recurrent state tensors remain internal.
 */
export class AcousticWindow {
  readonly speakerId: string;
  readonly timestampMs: number;
  readonly startMs: number;
  readonly endMs: number;
  readonly affectAvailable: boolean;
  private readonly state: AcousticState | null;
  private readonly change: AcousticChange | null;
  private readonly affect: AffectVad | null;

  private constructor(args: {
    speakerId: string;
    timestampMs: number;
    startMs: number;
    endMs: number;
    affectAvailable: boolean;
    state: AcousticState | null;
    change: AcousticChange | null;
    affect: AffectVad | null;
  }) {
    this.speakerId = args.speakerId;
    this.timestampMs = args.timestampMs;
    this.startMs = args.startMs;
    this.endMs = args.endMs;
    this.affectAvailable = args.affectAvailable;
    this.state = args.state;
    this.change = args.change;
    this.affect = args.affect;
  }

  /** Live analysis chunk (`directive` from `/v1/stream/realtime`). */
  static fromDirective(event: DirectiveEvent): AcousticWindow {
    const affectAvailable = event.affect_available === true;
    return new AcousticWindow({
      speakerId: event.speaker_id,
      timestampMs: event.timestamp_ms,
      startMs: Math.max(0, event.timestamp_ms - 1000),
      endMs: event.timestamp_ms,
      affectAvailable,
      state: event.acoustic_state ?? null,
      change: event.acoustic_change ?? null,
      affect: affectAvailable
        ? {
            valence: event.valence,
            arousal: event.arousal,
            dominance: event.dominance,
          }
        : null,
    });
  }

  /** One diarized batch window from `prosody_timeline`. */
  static fromTimelinePoint(
    point: ProsodyTimelinePoint,
    options?: { affectAvailable?: boolean },
  ): AcousticWindow {
    const affectAvailable = options?.affectAvailable === true;
    return new AcousticWindow({
      speakerId: point.speaker_id ?? 'unknown',
      timestampMs: point.end_ms,
      startMs: point.start_ms,
      endMs: point.end_ms,
      affectAvailable,
      state: point.acoustic_state ?? null,
      change: point.acoustic_change ?? null,
      affect: affectAvailable
        ? {
            valence: point.valence,
            arousal: point.arousal,
            dominance: point.dominance,
          }
        : null,
    });
  }

  /** Live step without requiring a full directive payload. */
  static fromLiveStep(args: {
    speakerId: string;
    timestampMs: number;
    acousticState: AcousticState | null;
    acousticChange?: AcousticChange | null;
    affectAvailable?: boolean;
  }): AcousticWindow {
    return new AcousticWindow({
      speakerId: args.speakerId,
      timestampMs: args.timestampMs,
      startMs: Math.max(0, args.timestampMs - 1000),
      endMs: args.timestampMs,
      affectAvailable: args.affectAvailable === true,
      state: args.acousticState,
      change: args.acousticChange ?? null,
      affect: null,
    });
  }

  getSpeakerId(): string {
    return this.speakerId;
  }

  /** Full gated `acoustic_state` object (values / masks / frames). */
  getAcousticState(): AcousticState | null {
    return this.state;
  }

  getAcousticChange(): AcousticChange | null {
    return this.change;
  }

  getValues(): AcousticStateValues | null {
    return this.state?.values ?? null;
  }

  getFrames(): AcousticStateFrames | null {
    return this.state?.frames ?? null;
  }

  getFeature(name: AcousticFeatureName): number | null {
    return finiteOrNull(this.state?.values?.[name]);
  }

  getDelta(name: AcousticDeltaName): number | null {
    return finiteOrNull(this.change?.values?.[name]);
  }

  /** Mimi-aligned frame trajectory for live windows. Batch reports omit frames. */
  getFrameSeries(name: AcousticFrameName): AcousticFramePoint[] {
    const frames = this.state?.frames;
    const values = frames?.[name];
    if (!Array.isArray(values)) return [];
    const frameRateHz = finiteOrNull(frames?.frame_rate_hz) ?? 12.5;
    return values.map((value, index) => ({
      timeMs: this.startMs + (index * 1000) / frameRateHz,
      value: finiteOrNull(value),
    }));
  }

  getPitch(): PitchReading {
    const values = this.state?.values;
    const masks = this.state?.masks;
    return {
      medianHz: finiteOrNull(values?.f0_median_hz),
      rangeSemitones: finiteOrNull(values?.f0_range_semitones),
      slopeSemitonesPerSecond: finiteOrNull(values?.f0_slope_semitones_per_second),
      available: masks?.f0_available === true,
    };
  }

  /** Convenience: median F0 Hz, or null. */
  getPitchHz(): number | null {
    const pitch = this.getPitch();
    return pitch.available ? pitch.medianHz : null;
  }

  getLevel(): LevelReading {
    const values = this.state?.values;
    return {
      rmsDbfs: finiteOrNull(values?.rms_dbfs),
      peakDbfs: finiteOrNull(values?.peak_dbfs),
      clippingRatio: finiteOrNull(values?.clipping_ratio),
    };
  }

  getVoicing(): VoicingReading {
    const values = this.state?.values;
    const mask = this.state?.masks?.voiced_mask;
    return {
      voicedRatio: finiteOrNull(values?.voiced_ratio),
      pauseRatio: finiteOrNull(values?.pause_ratio),
      onsetRateHz: finiteOrNull(values?.voice_onset_rate_hz),
      frameVoiced: Array.isArray(mask) ? [...mask] : null,
    };
  }

  getTilt(): number | null {
    if (this.state?.masks?.spectral_tilt_available === false) return null;
    return finiteOrNull(this.state?.values?.spectral_tilt_db_per_octave);
  }

  /**
   * Return V/A/D when the checkpoint marks affect as a trained measurement.
   */
  getVad(): AffectVad | null {
    return this.affectAvailable ? this.affect : null;
  }

  /** Speaker-relative deltas vs prior chunk in this speaker's recurrent scope. */
  getChange(): AcousticChange['values'] | null {
    return this.change?.values ?? null;
  }

  /** Developer-facing bundle of gated vocal measurements for this window. */
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
  } | null {
    const values = this.state?.values;
    if (!values) return null;
    return {
      rms_dbfs: finiteOrNull(values.rms_dbfs),
      peak_dbfs: finiteOrNull(values.peak_dbfs),
      f0_median_hz: finiteOrNull(values.f0_median_hz),
      f0_range_semitones: finiteOrNull(values.f0_range_semitones),
      f0_slope_semitones_per_second: finiteOrNull(values.f0_slope_semitones_per_second),
      spectral_tilt_db_per_octave: finiteOrNull(values.spectral_tilt_db_per_octave),
      voiced_ratio: finiteOrNull(values.voiced_ratio),
      pause_ratio: finiteOrNull(values.pause_ratio),
      clipping_ratio: finiteOrNull(values.clipping_ratio),
      voice_onset_rate_hz: finiteOrNull(values.voice_onset_rate_hz),
      change: this.change?.values ?? null,
      f0_available: this.state?.masks?.f0_available === true,
    };
  }
}

/** @deprecated Use AcousticWindow. */
export { AcousticWindow as RecurrentStep };

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
