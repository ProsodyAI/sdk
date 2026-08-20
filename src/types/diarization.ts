import type { AcousticChange, AcousticState } from './acoustic.js';
import type { ProsodyTimelinePoint } from './analysis.js';

/**
 * Per-speaker attribution accounting, and this speaker's pooled affect.
 *
 * V/A/D is the affect head's reading pooled over the windows attributed to
 * this speaker. All three are null for a speaker no window measured.
 */
export interface PerSpeakerAnalysis {
  speaker_id: string;
  talk_ms: number;
  window_count: number;
  turn_count: number;
  /** Pooled valence. Null when no window measured this speaker. */
  valence?: number | null;
  /** Pooled arousal. Null when no window measured this speaker. */
  arousal?: number | null;
  /** Pooled dominance. Null when no window measured this speaker. */
  dominance?: number | null;
  display_name?: string | null;
  signals?: Record<string, number> | null;
  /** Durable person identity resolved from the stored acoustic voice profile. */
  identity?: SpeakerIdentity | null;
}

/**
 * One recording-local identity lane. `speaker_id` is a session-local label
 * scoped to this recording.
 */
export interface DiarizedSpeaker {
  speaker_id: string;
  talk_ms: number;
  turn_count: number;
  window_count: number;
}

/**
 * Identity resolved for one session-local speaker lane.
 *
 * `speaker_id` is a session-local label and can change between calls.
 * `person_id` is the pseudonymous id of a profile the organization enrolled;
 * it is stable across that organization's sessions.
 */
export interface SpeakerIdentity {
  person_id?: string | null;
  display_name?: string | null;
  is_returning?: boolean;
  name_source?: string | null;
}

/** Rolling state for one speaker in the current conversation. */
export interface SpeakerProfile {
  speaker_id: string;
  talk_ms: number;
  window_count: number;
  turn_count: number;
  identity?: SpeakerIdentity | null;
  baseline?: Record<string, unknown> | null;
  range?: Record<string, unknown> | null;
  volatility?: Record<string, number> | null;
  trajectory?: Record<string, unknown> | null;
  delivery?: Record<string, number> | null;
  change?: Record<string, number> | null;
  contrast_pairs?: Array<Record<string, unknown>> | null;
}

export interface DiarizationTurn {
  start_ms: number;
  end_ms: number;
  speaker: string;
}

export interface DiarizationResult {
  model?: string;
  num_speakers?: number;
  speakers?: string[];
  turns?: DiarizationTurn[];
}

export interface DiarizationSegment {
  start_ms: number;
  end_ms: number;
  speaker: string;
}

export interface TranscriptSegment {
  start_ms: number;
  end_ms: number;
  text: string;
  speaker_id: string;
  /** Valence reading. Null on an unvoiced frame; the head is always trained. */
  valence: number | null;
  /** Arousal reading. Null on an unvoiced frame. */
  arousal: number | null;
  /** Dominance reading. Null on an unvoiced frame. */
  dominance: number | null;
  acoustic_state?: AcousticState | null;
  acoustic_change?: AcousticChange | null;
  sequence_frames?: Record<string, Array<number | null>>;
  speech_final?: boolean;
}

export interface TranscriptTurn {
  start_ms: number;
  end_ms: number;
  speaker_id: string;
  text: string;
  segments: TranscriptSegment[];
}

export interface SessionTranscript {
  session_id: string;
  duration_seconds: number;
  turns: TranscriptTurn[];
  segments: TranscriptSegment[];
  prosody_timeline: ProsodyTimelinePoint[];
  per_speaker: PerSpeakerAnalysis[];
  diarization?: DiarizationResult | null;
}
