export type {
  ProsodyConfig,
  EmotionResult,
  ProsodyMarkers,
  ProsodySignals,
  TurnProsody,
  VerticalAnalysis,
  ForwardPredictions,
  KPIImpactFactor,
  KPIRecommendedAction,
  KPIAlertResult,
  KPIPredictionResult,
  KPIOutcomeEntry,
  AnalysisResult,
  TranscriptSegment,
  TranscriptTurn,
  SessionTranscript,
  AnalysisOptions,
  FeedbackCorrectionOptions,
  FeedbackOutcomeOptions,
  SessionOutcomeOptions,
  PCMOptions,
  StreamingOptions,
  FineTuneConfig,
  FineTuneJob,
  FineTuneSample,
} from '@/types';

export type { ProsodyClientConfig, RetryConfig } from '@/config';

export {
  ProsodyError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  TimeoutError,
  ConnectionError,
} from '@/errors';

export { createWavBuffer } from '@/wav';
export { ProsodyClient } from '@/client';
export { ProsodyStream } from '@/stream';
export { ProsodyRealtimeStream } from '@/realtime';

export { ProsodyClient as default } from '@/client';
