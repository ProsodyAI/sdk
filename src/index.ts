export type {
  ProsodyFeatures,
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
  IntonationPhraseEvent,
  IntonationTerminal,
  ProminenceEvent,
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

export {
  ControlClient,
  type Precondition,
  type Directive,
  type DirectiveRef,
  type Lexicon,
  type Bundle,
  type DialoguePolicy,
  type CallState,
  type Transition,
  type StateDelta,
  type Agent,
  type AgentConfig,
  type CreateAgentRequest,
  type UpdateAgentRequest,
  type Listening,
  type Limits,
  type Account,
  type ErrorEnvelope,
} from './control.js';
export {
  endpoints,
  callControl,
  type ControlRoute,
  type ControlMethod,
  type ControlCall,
  type ControlResult,
  type ControlResponse,
  type ControlBody,
  type ControlPath,
  type ControlQuery,
} from './endpoints.js';
export type { paths as ControlPaths, components as ControlComponents } from './types/control.js';

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
  prosodyFromFrame,
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
export { parseProsodyEvent } from './events.js';
export {
  ProsodyRealtimeStream,
  realtimeWsUrl,
  type ListeningCapability,
  type ProsodyRealtimeConfig,
  type ProsodyRealtimeHandlers,
  type RealtimeEncoding,
} from './realtime.js';
export { createWavBuffer } from './wav.js';

export type {
  IpaTranscription,
  PhonemeSegment,
} from './types/phonetics.js';

export { ProsodyClient as default } from './client.js';
