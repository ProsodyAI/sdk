import type { AcousticChange, AcousticState } from './acoustic.js';
import type { ProsodyTimelinePoint } from './analysis.js';
import type {
  DiarizationSegment,
  PerSpeakerAnalysis,
  SessionTranscript,
  SpeakerProfile,
} from './diarization.js';

export interface ProsodyEmbedding {
  log_mel_means?: number[];
  mel_contour?: number[];
  n_mels?: number;
  n_frames?: number;
  f0_contour?: number[];
  energy_contour?: number[];
  f0_mean?: number;
  f0_std?: number;
  energy_mean?: number;
  energy_std?: number;
}

export type ProsodyEventType =
  | 'directive'
  | 'transcript_update'
  | 'speaker_update'
  | 'speaker_profiles'
  | 'session_end'
  | 'warning'
  | 'error';

/**
 * Live analysis event. `generation` / `seq` are optional on the API wire; when
 * a publisher includes them, clients may use them to drop stale packets.
 */
export interface ProsodyEventEnvelope<T extends ProsodyEventType> {
  session_id: string;
  generation?: number;
  seq?: number;
  type: T;
}

/** Media-plane mint request for `POST /v1/realtime/sessions`. */
export interface RealtimeSessionCreateOptions {
  participantName?: string;
  /**
   * Join an existing session's room instead of creating one. Every
   * participant in the room reaches the same model, so their voices advance
   * one speaker-state timeline.
   */
  sessionId?: string;
}

export interface RealtimeSessionCredentials {
  session_id: string;
  room_name: string;
  participant_identity: string;
  server_url: string;
  participant_token: string;
  expires_at: string;
  event_topic: string;
  control_topic: string;
}

/** The three affect dimensions as a nested block (stream `Prosody`). */
export interface AffectReading {
  /** Valence reading. Null on an unvoiced frame. */
  valence: number | null;
  /** Arousal reading. Null on an unvoiced frame. */
  arousal: number | null;
  /** Dominance reading. Null on an unvoiced frame. */
  dominance: number | null;
}

/** Matches api/models/stream_events.py Directive, the live product event. */
export interface DirectiveEvent extends ProsodyEventEnvelope<'directive'> {
  acoustic_state?: AcousticState | null;
  acoustic_change?: AcousticChange | null;
  prosody: AffectReading;
  /** Valence reading. Null on an unvoiced frame; the head is always trained. */
  valence: number | null;
  /** Arousal reading. Null on an unvoiced frame. */
  arousal: number | null;
  /** Dominance reading. Null on an unvoiced frame. */
  dominance: number | null;
  timings_ms: Record<string, number>;
  text: string;
  frames_processed: number;
  timestamp_ms: number;
  speaker_id: string;
  speaker_changed: boolean;
  num_speakers: number;
  diar_segments: DiarizationSegment[];
  is_agent?: boolean;
  phonemes: string[];
  ipa_transcript: string;
  /** Acoustic contour data for spectrogram rendering. */
  prosody_embedding: ProsodyEmbedding | null;
}

/**
 * Segments sharing a result_id replace the prior interim version. A final
 * update (`is_final: true`) commits that replacement.
 */
export interface TranscriptUpdateSegment {
  start_ms: number;
  end_ms: number;
  speaker_id: string;
  text: string;
  provider: string;
  result_id: string;
  is_final: boolean;
}

/** One lane-attributed word with session-absolute times (stream `TranscriptWord`). */
export interface TranscriptWord {
  word?: string | null;
  start_ms?: number | null;
  end_ms?: number | null;
  speaker_id?: string | null;
}

export interface TranscriptUpdateEvent extends ProsodyEventEnvelope<'transcript_update'> {
  provider: string;
  streaming: boolean;
  result_id: string;
  start_ms: number;
  end_ms: number;
  is_final: boolean;
  speech_final: boolean;
  segments: TranscriptUpdateSegment[];
  words?: TranscriptWord[];
}

/** Committed identity-lane attribution for one live interval. */
export interface SpeakerUpdateEvent extends ProsodyEventEnvelope<'speaker_update'> {
  start_ms: number;
  end_ms: number;
  speaker_id: string;
  /** Durable person identity when the model has resolved this lane. */
  person_id?: string | null;
  dominant_speaker_id?: string | null;
  speaker_changed: boolean;
  num_speakers: number;
  backend?: string | null;
  is_agent: boolean;
}

/**
 * Rolling speaker lanes with identity attached.
 * Emitted again as the model accumulates enough voice evidence to resolve a
 * stored person.
 */
export interface SpeakerProfilesEvent extends ProsodyEventEnvelope<'speaker_profiles'> {
  profiles: SpeakerProfile[];
  timestamp_ms?: number | null;
}

export interface SessionDiagnostic {
  bytes_received?: number;
  chunks_received?: number;
  audio_silent?: boolean;
  /**
   * The organization has enrolled voiceprints and zero carry the serving
   * embedding space, so returning voices cannot be recognized until
   * speakers re-enroll under the serving checkpoint.
   */
  known_speaker_space_mismatch?: boolean;
}

export interface SessionEndEvent extends ProsodyEventEnvelope<'session_end'> {
  frames_processed: number;
  transcript: SessionTranscript;
  prosody_timeline?: ProsodyTimelinePoint[] | null;
  per_speaker?: PerSpeakerAnalysis[] | null;
  synthesis_references?: Array<Record<string, unknown>>;
  diagnostic?: SessionDiagnostic;
}

export interface WarningEvent extends ProsodyEventEnvelope<'warning'> {
  code: string;
  message: string;
  diagnostic?: Partial<SessionDiagnostic>;
}

export interface ServerErrorEvent extends ProsodyEventEnvelope<'error'> {
  code?: string;
  message: string;
}

export type ProsodyEvent =
  | DirectiveEvent
  | TranscriptUpdateEvent
  | SpeakerUpdateEvent
  | SpeakerProfilesEvent
  | SessionEndEvent
  | WarningEvent
  | ServerErrorEvent;
