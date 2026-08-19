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
  AnalysisEvent,
  TurnBoundary,
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
  StateDeltaEvent,
  TurnBoundaryEvent,
  BargeInEvent,
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
  type MeasurementPoint,
  type ChangePoint,
  voiceFrames,
  measurementSeries,
} from './analysis.js';
export {
  VoiceFrame,
  type AffectVad,
} from './step.js';
export {
  Conversation,
  prosodyFromState,
  prosodyFromWindow,
  mergeTranscriptUpdateSegments,
  buildTurnsFromSegments,
  byMagnitude,
  type ConversationTurn,
  type MeasurementPath,
  type Moment,
  type Prosody,
  type ProsodyChange,
  type ProsodyDelta,
  type ProsodyState,
} from './conversation.js';
export { ProsodyClient } from './client.js';
export {
  LiveSession,
  type LiveSessionOptions,
  type LiveSessionStartOptions,
} from './live-session.js';
export {
  transcriptionFromConversation,
  Speaker,
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
