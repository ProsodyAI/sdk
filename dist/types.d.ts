export interface ProsodyConfig {
    apiKey: string;
    baseUrl?: string;
}
export interface ProsodyMarkers {
    pitch_trend?: string;
    intensity?: string;
    tempo?: string;
}
export interface ProsodyFeatures {
    valence: number;
    arousal: number;
    dominance: number;
    prosody?: ProsodyMarkers | null;
    pitch_mean?: number | null;
    pitch_std?: number | null;
    pitch_range?: number | null;
    energy_mean?: number | null;
    energy_std?: number | null;
    speech_rate?: number | null;
    jitter?: number | null;
    shimmer?: number | null;
    hnr?: number | null;
    spectral_centroid?: number | null;
    spectral_rolloff?: number | null;
}
export interface ProsodySignals {
    engagement?: number;
    stress?: number;
    certainty?: number;
    rapport?: number;
    empathy?: number;
    tempo?: number;
    intensity?: number;
    expressiveness?: number;
    [signal: string]: number | undefined;
}
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
/** Per-turn delivery (interview / call review product). */
export interface TurnProsody {
    valence: number;
    arousal: number;
    dominance: number;
    signals?: ProsodySignals | Record<string, number> | null;
    /** The trained measurement for the window covering this turn. */
    acoustic_state?: AcousticState | null;
    acoustic_change?: AcousticChange | null;
}
export interface KPIImpactFactor {
    signal: string;
    value: number;
    impact: number;
    description: string;
}
export interface KPIRecommendedAction {
    action: string;
    expected_impact: number;
    signal_target: string;
}
export interface KPIAlertResult {
    threshold: number;
    direction: string;
    message: string;
}
export interface KPIPredictionResult {
    kpi_id: string;
    kpi_name: string;
    kpi_type: 'SCALAR' | 'BINARY' | 'CATEGORICAL';
    predicted_value: any;
    trajectory?: string;
    impact_factors?: KPIImpactFactor[];
    recommended_actions?: KPIRecommendedAction[];
    alert?: KPIAlertResult;
}
export interface KPIOutcomeEntry {
    kpi_id: string;
    scalar_value?: number;
    boolean_value?: boolean;
    category_value?: string;
}
export type ProsodyTrajectory = 'rising' | 'declining' | 'stable';
export interface ProsodyTimelinePoint {
    start_ms: number;
    end_ms: number;
    speaker_id?: string;
    valence: number;
    arousal: number;
    dominance: number;
    signals?: Record<string, number> | null;
    sequence_signals?: Record<string, number> | null;
    seq_frame?: Record<string, number | number[]> | null;
    /** What this window measured. Present on every window of a diarized call. */
    acoustic_state?: AcousticState | null;
    /** Absent on a speaker's first window because there is nothing to compare against. */
    acoustic_change?: AcousticChange | null;
}
export interface ProsodySummary {
    valence: number;
    arousal: number;
    dominance: number;
    trajectory?: {
        valence: ProsodyTrajectory;
        arousal: ProsodyTrajectory;
        dominance: ProsodyTrajectory;
    };
    volatility?: {
        valence: number;
        arousal: number;
        dominance: number;
    };
    signals?: Record<string, number> | null;
    sequence_signals?: Record<string, number> | null;
    peak_arousal_ms?: number;
    window_count?: number;
}
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
export interface SpeakerDirectoryEntry {
    person_id: string;
    display_name?: string | null;
    last_seen_at?: number | null;
    last_session_id?: string | null;
    memory_count: number;
    enrollment_count?: number;
    evidence_seconds?: number;
    first_seen_at?: number | null;
    session_count?: number;
    turn_count?: number;
    talk_ms?: number;
    sample_text?: string | null;
}
export interface SpeakerDirectoryResult {
    speakers: SpeakerDirectoryEntry[];
    memory_total: number;
    memory_enabled: boolean;
    error?: string;
}
export interface VoiceEnrollmentSegment {
    start_ms: number;
    end_ms: number;
    text: string;
}
export interface VoiceEnrollmentLane {
    speaker_id: string;
    duration_ms: number;
    segments: VoiceEnrollmentSegment[];
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
export interface CallInsight {
    title: string;
    detail: string;
    at_ms: number | null;
    nearby_text?: string;
}
export interface AnalysisAlert {
    message: string;
    kpi_name?: string;
    threshold?: number;
    direction?: string;
    [field: string]: unknown;
}
export interface RecommendedAction {
    action: string;
    expected_impact?: number;
    signal_target?: string;
    kpi?: string;
    [field: string]: unknown;
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
export interface AnalysisTurn {
    start_ms: number;
    end_ms: number;
    speaker_id: string;
    text: string;
    prosody?: TurnProsody | null;
}
export interface AnalysisResult {
    prediction_id: string;
    session_id?: string | null;
    text: string;
    prosody: ProsodyFeatures;
    /**
     * Marks `prosody.valence/arousal/dominance` as trained measurements when true.
     */
    affect_available?: boolean;
    signals?: ProsodySignals | null;
    sequence_signals?: Record<string, number> | null;
    timings_ms?: Record<string, number> | null;
    duration: number;
    word_count: number;
    kpi_predictions?: KPIPredictionResult[] | null;
    alerts?: AnalysisAlert[] | null;
    recommended_actions?: RecommendedAction[] | null;
    turns?: AnalysisTurn[] | null;
    diarization?: DiarizationResult | null;
    prosody_timeline?: ProsodyTimelinePoint[] | null;
    prosody_summary?: ProsodySummary | null;
    per_speaker?: PerSpeakerAnalysis[] | null;
    call_insights?: CallInsight[] | null;
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
export interface AnalysisOptions {
    language?: string;
    sessionId?: string;
    /** Return diarized turns and call-level analysis. Defaults to true. */
    diarize?: boolean;
    /**
     * Include vocal measurement on transcript turns when using
     * {@link ProsodyClient.transcribe}. Defaults to true.
     */
    prosody?: boolean;
}
export interface FeedbackCorrectionOptions {
    predictionId: string;
    correctedValence?: number;
    correctedArousal?: number;
    correctedDominance?: number;
    notes?: string;
}
export interface SessionOutcomeOptions {
    sessionId: string;
    outcomes: KPIOutcomeEntry[];
    notes?: string;
}
export interface PCMOptions extends AnalysisOptions {
    sampleRate?: number;
    channels?: number;
    bitDepth?: number;
}
export type ModulationMode = 'normal' | 'caller_escalating' | 'mirror_calm' | 'agent_overheated' | 'caller_interrupting';
export interface ModulationTts {
    speed: number;
    pitch_shift_semitones: number;
    emotion: string;
    target_intensity: number;
    pre_pause_ms: number;
    stop?: boolean;
}
export interface DiarizationSegment {
    start_ms: number;
    end_ms: number;
    speaker: string;
}
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
export type ProsodyEventType = 'directive' | 'transcript_update' | 'speaker_update' | 'speaker_profiles' | 'session_end' | 'warning' | 'error';
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
/** Media-plane mint response from `POST /v1/realtime/sessions`. */
export interface RealtimeSessionCreateOptions {
    participantName?: string;
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
/** Matches api/models/stream_events.py Directive, the live product event. */
export interface DirectiveEvent extends ProsodyEventEnvelope<'directive'> {
    acoustic_state?: AcousticState | null;
    acoustic_change?: AcousticChange | null;
    /**
     * Marks valence, arousal, and dominance as trained measurements when true.
     */
    affect_available?: boolean;
    prosody: Pick<ProsodyFeatures, 'valence' | 'arousal' | 'dominance'>;
    valence: number;
    arousal: number;
    dominance: number;
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
export interface TranscriptUpdateEvent extends ProsodyEventEnvelope<'transcript_update'> {
    provider: string;
    streaming: boolean;
    result_id: string;
    start_ms: number;
    end_ms: number;
    is_final: boolean;
    speech_final: boolean;
    segments: TranscriptUpdateSegment[];
}
/** Committed identity-lane attribution for one live interval. */
export interface SpeakerUpdateEvent extends ProsodyEventEnvelope<'speaker_update'> {
    start_ms: number;
    end_ms: number;
    speaker_id: string;
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
export type ProsodyEvent = DirectiveEvent | TranscriptUpdateEvent | SpeakerUpdateEvent | SpeakerProfilesEvent | SessionEndEvent | WarningEvent | ServerErrorEvent;
