import { type MeasurementPath, type Prosody } from './conversation/prosody.js';
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
 * Validate the stable batch envelope.
 *
 * ProsodySSM's product output is `acoustic_state`, the measured waveform
 * values per window, which arrives on `prosody_timeline` and on each turn.
 * Valence / arousal / dominance are only readings when `affect_available` is
 * true, so they are never required here: a deployment that publishes
 * measurements and no affect is a correct deployment.
 */
export declare function parseAnalysisResult(value: unknown): AnalysisResult;
/**
 * Consumer view of one analyzed recording.
 *
 * Accessors over the measured acoustic timeline, transcript, and recording-local
 * committed identity lanes. Persistent identity lives under `client.speakers`.
 */
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
    /** Speaker-relative changes. The first window in each speaker lane has none. */
    getChanges(speakerId?: string): ChangePoint[];
    /** The measurement bundle on the latest (or indexed) acoustic window. */
    getProsody(windowIndex?: number): Prosody | null;
    /**
     * Affect VAD for the whole file when the checkpoint publishes it.
     * Null when `affect_available` is false.
     */
    getVad(): AffectVad | null;
    /** Valence for the whole file, or for one turn. Null when affect is not published. */
    getValence(turnIndex?: number): number | null;
    /** Raw API timeline for consumers that need the wire shape. */
    getTimeline(): ProsodyTimelinePoint[];
}
/**
 * The measured windows of a call, in order.
 *
 * Empty when the upload was not diarized (`diarize: false`), since the timeline
 * is only built for a diarized call.
 */
export declare function voiceFrames(result: AnalysisResult): ProsodyTimelinePoint[];
/**
 * Read one measurement across a call, skipping windows where it was not
 * measurable (an unvoiced window carries `null` pitch, without any floor value).
 */
export declare function measurementSeries(result: AnalysisResult, path: MeasurementPath): {
    start_ms: number;
    end_ms: number;
    speaker_id?: string;
    value: number;
}[];
