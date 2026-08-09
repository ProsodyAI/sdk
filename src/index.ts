export type {
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
  KPIOutcomeEntry,
  ProsodyTrajectory,
  ProsodyTimelinePoint,
  PerSpeakerAnalysis,
  DiarizedSpeaker,
  SpeakerIdentity,
  SpeakerProfile,
  SpeakerDirectoryEntry,
  SpeakerDirectoryResult,
  VoiceEnrollmentLane,
  VoiceEnrollmentPreview,
  VoiceEnrollmentMapping,
  VoiceEnrollmentResult,
  DiarizationTurn,
  DiarizationResult,
  AnalysisTurn,
  AnalysisResult,
  TranscriptionStatus,
  TranscriptSegment,
  TranscriptTurn,
  SessionTranscript,
  AnalysisOptions,
  FeedbackCorrectionOptions,
  SessionOutcomeOptions,
  PCMOptions,
  DiarizationSegment,
  ProsodyEmbedding,
  ProsodyEventType,
  ProsodyEventEnvelope,
  AffectReading,
  DirectiveEvent,
  TranscriptWord,
  TranscriptUpdateSegment,
  TranscriptUpdateEvent,
  SpeakerUpdateEvent,
  SpeakerProfilesEvent,
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
  LiveSession,
  type LiveSessionOptions,
  type LiveSessionStartOptions,
} from './live-session.js';
export {
  transcriptionFromConversation,
  prosodyFromVocalFeatures,
  Speaker,
  type Prosody,
  type ProsodyChange,
  type TranscribeOptions,
  type TranscribeTurn,
  type Transcription,
  type VoiceProfile,
  type VoiceStat,
} from './transcription.js';
export {
  applySpeakerUpdateToSegments,
} from './conversation.js';
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
