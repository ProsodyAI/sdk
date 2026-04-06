export interface ProsodyConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface EmotionResult {
  primary: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface ProsodyMarkers {
  pitch_trend?: string;
  intensity?: string;
  tempo?: string;
}

export interface ProsodySignals {
  engagement: number;
  stress: number;
  certainty: number;
  rapport: number;
  empathy: number;
  tempo: number;
  intensity: number;
  expressiveness: number;
}

export interface VerticalAnalysis {
  vertical: string;
  state: string;
  state_description?: string;
  metrics: Record<string, any>;
  alerts?: Array<{ metric: string; value: any; threshold: any }>;
}

/**
 * @deprecated Use KPIPredictionResult instead. Kept for backward compatibility.
 */
export interface ForwardPredictions {
  will_escalate: number;
  escalation_onset: number;
  final_csat_predicted: number;
  churn_risk: number;
  resolution_probability: number;
  deal_close_probability: number;
  intervention_needed: number;
  sentiment_forecast: number;
  recommended_tone: string;
  tone_confidence: number;
  prediction_confidence: number;
  utterances_seen: number;
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

export interface AnalysisResult {
  prediction_id: string;
  session_id?: string;
  text: string;
  emotion: EmotionResult;
  valence: number;
  arousal: number;
  dominance: number;
  prosody?: ProsodyMarkers;
  signals?: ProsodySignals;
  speaker_id?: string;
  duration: number;
  word_count: number;
  format: string;
  kpi_predictions?: KPIPredictionResult[];
  alerts?: KPIAlertResult[];
  vertical_analysis?: VerticalAnalysis;
  /** @deprecated Use kpi_predictions instead. */
  forward_predictions?: ForwardPredictions;
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
  signals?: Record<string, number>;
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
}

export interface SessionTranscript {
  session_id: string;
  duration_seconds: number;
  turns: TranscriptTurn[];
  segments?: TranscriptSegment[];
}

export interface AnalysisOptions {
  language?: string;
  vertical?: string;
  sessionId?: string;
  includeFeatures?: boolean;
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
  outcomes?: KPIOutcomeEntry[];
  notes?: string;
  /** @deprecated Pass outcomes via the `outcomes` array instead. */
  vertical?: string;
  /** @deprecated Pass outcomes via the `outcomes` array instead. */
  actualCsat?: number;
  /** @deprecated Pass outcomes via the `outcomes` array instead. */
  escalated?: boolean;
  /** @deprecated Pass outcomes via the `outcomes` array instead. */
  churned?: boolean;
  /** @deprecated Pass outcomes via the `outcomes` array instead. */
  firstCallResolved?: boolean;
  /** @deprecated Pass outcomes via the `outcomes` array instead. */
  transferred?: boolean;
  /** @deprecated Pass outcomes via the `outcomes` array instead. */
  dealWon?: boolean;
  /** @deprecated Pass outcomes via the `outcomes` array instead. */
  dealValue?: number;
  /** @deprecated Pass outcomes via the `outcomes` array instead. */
  daysToClose?: number;
  /** @deprecated Pass outcomes via the `outcomes` array instead. */
  phqScore?: number;
  /** @deprecated Pass outcomes via the `outcomes` array instead. */
  interventionOccurred?: boolean;
  /** @deprecated Pass outcomes via the `outcomes` array instead. */
  followUpScheduled?: boolean;
  /** @deprecated Pass outcomes via the `outcomes` array instead. */
  finalSentiment?: number;
}

export interface PCMOptions extends AnalysisOptions {
  sampleRate?: number;
  channels?: number;
  bitDepth?: number;
}

export interface StreamingOptions extends PCMOptions {
  sessionId?: string;
  onResult?: (result: AnalysisResult) => void;
  onTranscript?: (transcript: SessionTranscript) => void;
  onEscalationAlert?: (alert: { onset_probability: number; recommended_tone: string; segment_id: string }) => void;
  onError?: (error: Error) => void;
  chunkDuration?: number;
}

export interface FineTuneConfig {
  name: string;
  description?: string;
  baseModel?: string;
  vertical?: string;
  epochs?: number;
}

export interface FineTuneJob {
  id: string;
  status: 'pending' | 'training' | 'completed' | 'failed';
  name: string;
  progress?: number;
  modelId?: string;
  createdAt: string;
  completedAt?: string;
  metrics?: Record<string, any>;
}

export interface FineTuneSample {
  audioUrl?: string;
  audioBase64?: string;
  emotion: string;
  metadata?: Record<string, string>;
}
