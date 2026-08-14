/**
 * Tenant-scoped recall of a person's ranked significant moments. These
 * interfaces mirror the API's memory route payloads field for field.
 *
 * Operator surface: shipped in the package for internal tooling, absent
 * from the published entry point's type exports and the docs.
 */
/** The measured facts a stored moment carries. Extra keys pass through. */
export interface MomentMetadata {
    person_id?: string | null;
    session_id?: string | null;
    speaker_id?: string | null;
    /** The moment's onset on its session's clock (ms). */
    at_ms?: number | null;
    /** Words that landed around the moment. */
    text?: string | null;
    title?: string | null;
    detail?: string | null;
    /** Magnitude of the measured state delta that selected this moment. */
    significance?: number | null;
    valence?: number | null;
    arousal?: number | null;
    dominance?: number | null;
    /** Pointer at the person's persisted recurrent-state snapshot. */
    state_ref?: string | null;
    embedding_space?: string | null;
    [key: string]: unknown;
}
/** One recalled moment: the record id and its measured facts. */
export interface MomentRecord {
    id: string;
    metadata: MomentMetadata;
}
export interface RecallResult {
    person_id?: string | null;
    is_returning: boolean;
    memories: MomentRecord[];
    /** Distilled inner-monologue preamble, ready to prime an S2S model. */
    preamble: string;
}
