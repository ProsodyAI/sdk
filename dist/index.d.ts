export type { ProsodyConfig, ProsodyMarkers, ProsodyFeatures, ProsodySignals, AcousticProvenance, AcousticStateValues, AcousticStateMasks, AcousticStateFrames, AcousticState, AcousticChangeValues, AcousticChange, TurnProsody, KPIImpactFactor, KPIRecommendedAction, KPIAlertResult, KPIPredictionResult, KPIOutcomeEntry, ProsodyTrajectory, ProsodyTimelinePoint, ProsodySummary, PerSpeakerAnalysis, CallInsight, AnalysisAlert, RecommendedAction, DiarizationTurn, DiarizationResult, AnalysisTurn, AnalysisResult, TranscriptSegment, TranscriptTurn, SessionTranscript, AnalysisOptions, FeedbackCorrectionOptions, FeedbackOutcomeOptions, SessionOutcomeOptions, PCMOptions, ModulationMode, ModulationTts, AgentModulation, ForwardPrediction, DiarizationSegment, ProsodyEmbedding, ProsodyEventType, ProsodyEventEnvelope, DirectiveEvent, TranscriptUpdateSegment, TranscriptUpdateEvent, AgentSteeringEvent, InsightsUpdateEvent, SessionDiagnostic, SessionEndEvent, WarningEvent, ServerErrorEvent, ProsodyEvent, } from './types.js';
export type { ProsodyClientConfig, RetryConfig } from './config.js';
export type { LiveKitParticipantLike, LiveKitDataReceivedHandler, LiveKitRoomLike, ProsodySessionOptions, } from './session.js';
export { ProsodyError, AuthenticationError, RateLimitError, ValidationError, TimeoutError, ConnectionError, } from './errors.js';
export { parseAnalysisResult, acousticWindows, acousticSeries } from './analysis.js';
export { ProsodyClient } from './client.js';
export { PROSODY_EVENT_TOPIC, ProsodySession, parseProsodyEvent, } from './session.js';
export { createWavBuffer } from './wav.js';
export { ProsodyClient as default } from './client.js';
