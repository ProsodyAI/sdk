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

export interface VerticalAnalysis {
  vertical: string;
  state: string;
  state_description?: string;
  metrics: Record<string, any>;
  alerts?: Array<{ metric: string; value: any; threshold: any }>;
}

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

export interface AnalysisResult {
  prediction_id: string;
  session_id?: string;
  text: string;
  emotion: EmotionResult;
  valence: number;
  arousal: number;
  dominance: number;
  prosody?: ProsodyMarkers;
  duration: number;
  word_count: number;
  format: string;
  vertical_analysis?: VerticalAnalysis;
  forward_predictions?: ForwardPredictions;
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
  vertical: string;
  actualCsat?: number;
  escalated?: boolean;
  churned?: boolean;
  firstCallResolved?: boolean;
  transferred?: boolean;
  dealWon?: boolean;
  dealValue?: number;
  daysToClose?: number;
  phqScore?: number;
  interventionOccurred?: boolean;
  followUpScheduled?: boolean;
  finalSentiment?: number;
  notes?: string;
}

export interface PCMOptions extends AnalysisOptions {
  sampleRate?: number;
  channels?: number;
  bitDepth?: number;
}

export interface StreamingOptions extends PCMOptions {
  sessionId?: string;
  onResult?: (result: AnalysisResult) => void;
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
}

export interface FineTuneSample {
  audioUrl?: string;
  audioBase64?: string;
  emotion: string;
  metadata?: Record<string, string>;
}
