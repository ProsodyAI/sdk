import { type MeasurementName, type Prosody, type ProsodyChange } from './conversation/prosody.js';
import { AcousticWindow, type AffectVad, type PitchReading } from './step.js';
import type { AnalysisResult, AnalysisTurn, DiarizedSpeaker, ProsodyTimelinePoint } from './types.js';
export interface MeasurementPoint {
    startMs: number;
    endMs: number;
    speakerId: string;
    value: number;
}
export interface ChangePoint {
    startMs: number;
    endMs: number;
    speakerId: string;
    reference: string | null;
    values: Partial<ProsodyChange>;
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
    getTranscript(): string;
    getTurns(): AnalysisTurn[];
    getTurn(index: number): AnalysisTurn | null;
    getSpeakers(): DiarizedSpeaker[];
    /** Measured windows produced from Mimi-latent recurrent analysis. */
    getAcoustics(speakerId?: string): AcousticWindow[];
    getAcousticWindow(index: number): AcousticWindow | null;
    /** One physical measurement across the recording, optionally for one speaker. */
    getMeasurementSeries(name: MeasurementName, speakerId?: string): MeasurementPoint[];
    /** Speaker-relative changes. The first window in each speaker lane has none. */
    getChanges(speakerId?: string): ChangePoint[];
    /** The measurement bundle on the latest (or indexed) acoustic window. */
    getProsody(windowIndex?: number): Prosody | null;
    /** Pitch series across windows, skipping unvoiced measurements. */
    getPitch(speakerId?: string): MeasurementPoint[];
    getPitchAt(windowIndex: number): PitchReading | null;
    /**
     * Affect VAD for the whole file when the checkpoint publishes it.
     * Null when `affect_available` is false.
     */
    getVad(): AffectVad | null;
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
export declare function acousticWindows(result: AnalysisResult): ProsodyTimelinePoint[];
/**
 * Read one measurement across a call, skipping windows where it was not
 * measurable (an unvoiced window carries `null` f0, without any floor value).
 */
export declare function measurementSeries(result: AnalysisResult, name: MeasurementName): {
    start_ms: number;
    end_ms: number;
    speaker_id?: string;
    value: number;
}[];
