import { type MeasurementPath, type Prosody } from './conversation/prosody.js';
import { type Moment } from './conversation/moments.js';
import { VoiceFrame, type AffectVad } from './step.js';
import type { AnalysisResult, AnalysisTurn, DiarizedSpeaker, ProsodyTimelinePoint } from './types.js';
/** One measured value on the call clock, attributed to a speaker. */
export interface MeasurementPoint {
    /** Start of the measured frame, in ms. */
    startMs: number;
    /** End of the measured frame, in ms. */
    endMs: number;
    /** Conversation-local lane this point was attributed to. */
    speakerId: string;
    /** The measured value. */
    value: number;
}
/** One speaker-relative movement, with the baseline it was judged against. */
export interface ChangePoint {
    /** Start of the frame, in ms. */
    startMs: number;
    /** End of the frame, in ms. */
    endMs: number;
    /** Conversation-local lane this change was attributed to. */
    speakerId: string;
    /** Baseline label the change was measured against, when the wire carries one. */
    reference: string | null;
    /** The committed movement, in the same family shape as `state`. */
    values: NonNullable<Prosody['change']>;
}
/**
 * Validate the stable batch envelope. Affect dimensions may each be `null`
 * on an unvoiced frame; a payload with only acoustic state is valid.
 */
export declare function parseAnalysisResult(value: unknown): AnalysisResult;
/** Consumer view of one analyzed recording: timeline, transcript, and lanes. */
export declare class ConversationAnalysis {
    private readonly result;
    constructor(data: AnalysisResult);
    /** Full transcript text. */
    getTranscript(): string;
    /** Diarized turns, in order. */
    getTurns(): AnalysisTurn[];
    /** One turn by index, or null when out of range. */
    getTurn(index: number): AnalysisTurn | null;
    /** Recording-local speakers with talk time and turn counts. */
    getSpeakers(): DiarizedSpeaker[];
    /** Measured frames produced from Mimi-latent recurrent analysis. */
    getFrames(speakerId?: string): VoiceFrame[];
    /** One frame by index, or null when out of range. */
    getVoiceFrame(index: number): VoiceFrame | null;
    /** One physical measurement across the recording, optionally for one speaker. */
    getMeasurementSeries(path: MeasurementPath, speakerId?: string): MeasurementPoint[];
    /** Speaker-relative changes. The first frame in each speaker lane has none. */
    getChanges(speakerId?: string): ChangePoint[];
    /** Committed `state_delta` moments, in commit order. */
    getMoments(speakerId?: string): Moment[];
    /** Committed moments sorted by descending magnitude. */
    getTopMoments(limit?: number, speakerId?: string): Moment[];
    /** The measurement bundle on the latest (or indexed) frame. */
    getProsody(frameIndex?: number): Prosody | null;
    /** File-level emotional attributes. Null when every dimension is null. */
    getVad(): AffectVad | null;
    /** Valence for the whole file, or for one turn. Null on an unvoiced frame. */
    getValence(turnIndex?: number): number | null;
    /** Raw API timeline for consumers that need the wire shape. */
    getTimeline(): ProsodyTimelinePoint[];
}
/** The measured frames of a call, in order. Empty when `diarize: false`. */
export declare function voiceFrames(result: AnalysisResult): ProsodyTimelinePoint[];
/** Read one measurement across a call, skipping frames where it was not measurable. */
export declare function measurementSeries(result: AnalysisResult, path: MeasurementPath): {
    start_ms: number;
    end_ms: number;
    speaker_id?: string;
    value: number;
}[];
