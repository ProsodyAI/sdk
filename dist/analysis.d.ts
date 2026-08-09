import type { AcousticState, AnalysisResult, AnalysisTurn, DiarizedSpeaker, ProsodyTimelinePoint } from './types.js';
import { AcousticWindow, type AcousticDeltaName, type AcousticFeatureName, type AffectVad, type PitchReading } from './step.js';
export interface AcousticFeaturePoint {
    startMs: number;
    endMs: number;
    speakerId: string;
    value: number;
}
export interface AcousticDeltaPoint {
    startMs: number;
    endMs: number;
    speakerId: string;
    reference: string | null;
    values: Partial<Record<AcousticDeltaName, number>>;
}
/**
 * Validate the stable batch envelope.
 *
 * ProsodySSM's product output is `acoustic_state` — measured waveform values
 * per window — which arrives on `prosody_timeline` and on each turn. Valence /
 * arousal / dominance are only readings when `affect_available` is true, so
 * they are never required here: a deployment that publishes measurements and
 * no affect is a correct deployment, not a malformed response.
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
    getFeatureSeries(name: AcousticFeatureName, speakerId?: string): AcousticFeaturePoint[];
    /** Speaker-relative changes. The first window in each speaker lane has none. */
    getDeltas(speakerId?: string): AcousticDeltaPoint[];
    /** Vocal features on the latest (or indexed) acoustic window. */
    getVocalFeatures(windowIndex?: number): ReturnType<AcousticWindow['getVocalFeatures']>;
    /** Pitch series across windows, skipping unvoiced measurements. */
    getPitch(speakerId?: string): AcousticFeaturePoint[];
    getPitchAt(windowIndex: number): PitchReading | null;
    /**
     * Affect VAD for the whole file when the checkpoint publishes it.
     * Null when `affect_available` is false.
     */
    getVad(): AffectVad | null;
    getValence(turnIndex?: number): number | null;
    /** Raw API timeline for consumers that need the wire shape. */
    getTimeline(): ProsodyTimelinePoint[];
    /** @deprecated Use getAcoustics(). */
    getRecurrentSteps(): AcousticWindow[];
    /** @deprecated Use getAcousticWindow(). */
    getRecurrentStep(index: number): AcousticWindow | null;
}
/**
 * The measured windows of a call, in order.
 *
 * Empty when the upload was not diarized (`diarize: false`), since the timeline
 * is only built for a diarized call.
 */
export declare function acousticWindows(result: AnalysisResult): ProsodyTimelinePoint[];
/**
 * Read one measured feature across a call, skipping windows where it was not
 * measurable (unvoiced windows carry `null` f0 rather than a floor value).
 */
export declare function acousticSeries(result: AnalysisResult, feature: keyof NonNullable<AcousticState['values']> & string): {
    start_ms: number;
    end_ms: number;
    speaker_id?: string;
    value: number;
}[];
