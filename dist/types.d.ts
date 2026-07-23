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
/** Per-turn delivery (interview / call review product). */
export interface TurnProsody {
    valence: number;
    arousal: number;
    dominance: number;
    confidence: number;
    signals?: ProsodySignals | Record<string, number> | null;
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
    confidence: number;
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
    valence: number;
    arousal: number;
    dominance: number;
    signals?: Record<string, number> | null;
    sequence_signals?: Record<string, number> | null;
    seq_frame?: Record<string, number | number[]> | null;
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
    score?: number;
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
    emotion: string;
    confidence: number;
    valence: number;
    arousal: number;
    dominance: number;
    signals?: Record<string, number> | null;
    sequence_signals?: Record<string, number> | null;
}
export interface TranscriptTurn {
    start_ms: number;
    end_ms: number;
    speaker_id: string;
    text: string;
    segments: TranscriptSegment[];
    dominant_emotion: string;
    avg_confidence: number;
    avg_valence: number;
    avg_arousal: number;
    avg_dominance: number;
    prosody: TurnProsody;
}
export interface SessionTranscript {
    session_id: string;
    duration_seconds: number;
    turns: TranscriptTurn[];
    segments: TranscriptSegment[];
    steering_events: AgentSteeringEvent[];
    prosody_timeline: ProsodyTimelinePoint[];
    per_speaker: PerSpeakerAnalysis[];
    sequence_signals: Record<string, number> | null;
    call_insights: CallInsight[];
    alerts: AnalysisAlert[];
    recommended_actions: RecommendedAction[];
}
export interface AnalysisOptions {
    language?: string;
    sessionId?: string;
    /** Return diarized turns and call-level analysis. Defaults to true. */
    diarize?: boolean;
}
export interface FeedbackCorrectionOptions {
    predictionId: string;
    correctEmotion: string;
    correctValence?: number;
    correctArousal?: number;
    correctDominance?: number;
    notes?: string;
}
export interface FeedbackOutcomeOptions {
    predictionId: string;
    vertical: string;
    outcomeCorrect?: boolean;
    actualCsat?: number;
    dealWon?: boolean;
    dealValue?: number;
    phqScore?: number;
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
export interface AgentModulation {
    mode: ModulationMode;
    intensity: number;
    tts: ModulationTts;
    system_prompt_fragment: string;
    should_yield: boolean;
    recommended_tone: string;
}
export interface ForwardPrediction {
    will_escalate: number;
    escalation_onset: number;
    churn_risk: number;
    final_csat: number;
    resolution_prob: number;
    sentiment_forecast: number;
    recommended_tone: string;
    tone_confidence: number;
    prediction_confidence: number;
    utterances_seen: number;
}
export interface DiarizationSegment {
    start_ms: number;
    end_ms: number;
    speaker: string;
    score: number;
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
export type ProsodyEventType = 'directive' | 'transcript_update' | 'agent_steering' | 'insights_update' | 'session_end' | 'warning' | 'error';
/**
 * Every LiveKit room event belongs to one session generation and has a
 * generation-local monotonic sequence number.
 */
export interface ProsodyEventEnvelope<T extends ProsodyEventType> {
    session_id: string;
    generation: number;
    seq: number;
    type: T;
}
export interface DirectiveEvent extends ProsodyEventEnvelope<'directive'> {
    prosody: Pick<ProsodyFeatures, 'valence' | 'arousal' | 'dominance'>;
    signals: ProsodySignals;
    sequence_signals: Record<string, number>;
    timings_ms: Record<string, number>;
    text: string;
    frames_processed: number;
    timestamp_ms: number;
    speaker_id: string;
    is_overlap: boolean;
    speaker_changed: boolean;
    speech_ratio: number;
    speaker_activity_available: boolean;
    num_speakers: number;
    diar_segments: DiarizationSegment[];
    phonemes: string[];
    ipa_transcript: string;
    prosody_embedding: ProsodyEmbedding | null;
    forward_prediction: ForwardPrediction | null;
    kpi_predictions?: KPIPredictionResult[];
    alerts?: AnalysisAlert[];
    recommended_actions?: RecommendedAction[];
    agent_modulation?: AgentModulation | null;
    modulation_mode: ModulationMode;
    is_escalating: boolean;
    is_interrupting: boolean;
    should_yield: boolean;
    is_steering: boolean;
    tts_speed: number;
    valence?: number;
    arousal?: number;
    dominance?: number;
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
export interface AgentSteeringEvent extends ProsodyEventEnvelope<'agent_steering'> {
    previous_mode: ModulationMode;
    mode: ModulationMode;
    intensity: number;
    reason: string;
    tts: ModulationTts;
    system_prompt: string;
    should_yield: boolean;
    timestamp_ms: number;
    recommended_tone: string;
}
export interface InsightsUpdateEvent extends ProsodyEventEnvelope<'insights_update'> {
    call_insights: CallInsight[];
    alerts: AnalysisAlert[];
    recommended_actions: RecommendedAction[];
    timestamp_ms: number;
}
export interface SessionDiagnostic {
    bytes_received: number;
    chunks_received: number;
    chunks_all_zero: number;
    chunks_gated_silent: number;
    samples_nonzero: number;
    frames_processed: number;
    audio_silent: boolean;
    input_sample_rate: number;
    input_encoding: string;
}
export interface SessionEndEvent extends ProsodyEventEnvelope<'session_end'> {
    frames_processed: number;
    transcript: SessionTranscript;
    call_insights: CallInsight[];
    sequence_signals: Record<string, number> | null;
    alerts: AnalysisAlert[];
    recommended_actions: RecommendedAction[];
    prosody_timeline: ProsodyTimelinePoint[];
    per_speaker: PerSpeakerAnalysis[];
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
export type ProsodyEvent = DirectiveEvent | TranscriptUpdateEvent | AgentSteeringEvent | InsightsUpdateEvent | SessionEndEvent | WarningEvent | ServerErrorEvent;
