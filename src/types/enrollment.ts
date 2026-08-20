export interface SpeakerDirectoryEntry {
  person_id: string;
  display_name?: string | null;
  first_heard_at?: number | null;
  last_heard_at?: number | null;
  last_seen_at?: number | null;
  last_session_id?: string | null;
  moment_count: number;
  /** Person ids folded into this lineage by an operator merge. */
  merged_from?: string[] | null;
  enrollment_count?: number;
  evidence_seconds?: number;
  first_seen_at?: number | null;
  session_count?: number | null;
  turn_count?: number | null;
  talk_ms?: number | null;
  sample_text?: string | null;
}

export interface SpeakerDirectoryResult {
  speakers: SpeakerDirectoryEntry[];
  moment_total: number;
  moments_enabled: boolean;
}

/** One model-committed speaker lane from a previewed recording. */
export interface VoiceEnrollmentLane {
  speaker_id: string;
  duration_ms?: number | null;
}

export interface VoiceEnrollmentPreview {
  preview_sha256: string;
  lanes: VoiceEnrollmentLane[];
  requires_explicit_mapping: boolean;
}

export interface VoiceEnrollmentMapping {
  speaker_id: string;
  display_name: string;
  /** Set to add evidence to an existing person instead of creating one. */
  person_id?: string;
}

export interface VoiceEnrollmentResult {
  preview_sha256: string;
  enrolled: Array<{
    speaker_id: string;
    person_id: string;
    display_name: string;
  }>;
}
