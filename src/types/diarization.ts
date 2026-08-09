import type { AcousticChange, AcousticState } from './acoustic.js';
import type { ProsodyTimelinePoint } from './analysis.js';

export interface PerSpeakerAnalysis {
  speaker_id: string;
  talk_ms: number;
  window_count: number;
  valence: number;
  arousal: number;
  dominance: number;
  signals?: Record<string, number> | null;
  /** Durable person identity resolved from the stored acoustic voice profile. */
  identity?: SpeakerIdentity | null;
}

/**
 * One recording-local identity lane. This consumer type deliberately carries
 * no voiceprint, embedding, person ID, or cross-conversation identity.
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
 * `speaker_id` can change between calls. `person_id` is the tenant-scoped,
 * durable identity that survives sessions and devices.
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
  valence: number;
  arousal: number;
  dominance: number;
  affect_available: boolean;
  acoustic_state?: AcousticState | null;
  acoustic_change?: AcousticChange | null;
  sequence_frames?: Record<string, number[]>;
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
