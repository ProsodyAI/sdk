import type { AcousticState, AnalysisResult, ProsodyTimelinePoint } from './types.js';
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
