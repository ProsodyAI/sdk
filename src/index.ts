export type {
  ProsodyConfig,
  ProsodyMarkers,
  ProsodyFeatures,
  ProsodySignals,
  AcousticProvenance,
  AcousticStateValues,
  AcousticStateMasks,
  AcousticStateFrames,
  AcousticState,
  AcousticChangeValues,
  AcousticChange,
  TurnProsody,
  KPIImpactFactor,
  KPIRecommendedAction,
  KPIAlertResult,
  KPIPredictionResult,
  KPIOutcomeEntry,
  ProsodyTrajectory,
  ProsodyTimelinePoint,
  ProsodySummary,
  PerSpeakerAnalysis,
  DiarizedSpeaker,
  SpeakerIdentity,
  SpeakerProfile,
  SpeakerDirectoryEntry,
  SpeakerDirectoryResult,
  VoiceEnrollmentSegment,
  VoiceEnrollmentCluster,
  VoiceEnrollmentPreview,
  VoiceEnrollmentMapping,
  VoiceEnrollmentResult,
  CallInsight,
  AnalysisAlert,
  RecommendedAction,
  DiarizationTurn,
  DiarizationResult,
  AnalysisTurn,
  AnalysisResult,
  TranscriptSegment,
  TranscriptTurn,
  SessionTranscript,
  AnalysisOptions,
  FeedbackCorrectionOptions,
  FeedbackOutcomeOptions,
  SessionOutcomeOptions,
  PCMOptions,
  ModulationMode,
  ModulationTts,
  AgentModulation,
  ForwardPrediction,
  DiarizationSegment,
  SpeakerMerge,
  ProsodyEmbedding,
  ProsodyEventType,
  ProsodyEventEnvelope,
  DirectiveEvent,
  TranscriptUpdateSegment,
  TranscriptUpdateEvent,
  SpeakerUpdateEvent,
  SpeakerClusterUpdateEvent,
  SpeakerProfilesEvent,
  AgentSteeringEvent,
  InsightsUpdateEvent,
  SessionDiagnostic,
  SessionEndEvent,
  WarningEvent,
  ServerErrorEvent,
  ProsodyEvent,
} from './types.js';

export type { ProsodyClientConfig, RetryConfig } from './config.js';
export type {
  LiveKitParticipantLike,
  LiveKitDataReceivedHandler,
  LiveKitRoomLike,
  ProsodySessionOptions,
} from './session.js';

export {
  ProsodyError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  TimeoutError,
  ConnectionError,
} from './errors.js';

export {
  parseAnalysisResult,
  ConversationAnalysis,
  type AcousticFeaturePoint,
  type AcousticDeltaPoint,
  acousticWindows,
  acousticSeries,
} from './analysis.js';
export {
  AcousticWindow,
  RecurrentStep,
  type AcousticFeatureName,
  type AcousticDeltaName,
  type AcousticFrameName,
  type AcousticFramePoint,
  type AffectVad,
  type PitchReading,
  type LevelReading,
  type VoicingReading,
} from './step.js';
export {
  Conversation,
  vocalFeaturesFromWindow,
  vocalFeaturesFromState,
  mergeTranscriptUpdateSegments,
  buildTurnsFromSegments,
  type ConversationTurn,
  type VocalFeatures,
} from './conversation.js';
export { ProsodyClient } from './client.js';
export {
  PROSODY_EVENT_TOPIC,
  ProsodySession,
  parseProsodyEvent,
} from './session.js';
export {
  ProsodyRealtimeStream,
  realtimeWsUrl,
  type ProsodyRealtimeConfig,
  type ProsodyRealtimeHandlers,
  type RealtimeEncoding,
} from './realtime.js';
export { createWavBuffer } from './wav.js';

export type {
  RealtimeSessionCreateOptions,
  RealtimeSessionCredentials,
} from './types.js';

export { ProsodyClient as default } from './client.js';
