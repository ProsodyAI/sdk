import type { AcousticState, AcousticChange, AnalysisResult, ProsodyEvent, SpeakerIdentity, SpeakerProfile, TranscriptUpdateSegment } from './types.js';
import { AcousticWindow } from './step.js';
/** Gated vocal measurements Bob reads — same fields as `acoustic_state.values`. */
export interface VocalFeatures {
    rms_dbfs: number | null;
    peak_dbfs: number | null;
    f0_median_hz: number | null;
    f0_range_semitones: number | null;
    f0_slope_semitones_per_second: number | null;
    spectral_tilt_db_per_octave: number | null;
    voiced_ratio: number | null;
    pause_ratio: number | null;
    clipping_ratio: number | null;
    voice_onset_rate_hz: number | null;
    /** Speaker-relative deltas; null on first window for that speaker. */
    change: AcousticChange['values'] | null;
    f0_available: boolean;
}
/** One diarized transcript turn — Bob’s spine (matches demo LiveTurn intent). */
export interface ConversationTurn {
    speaker_id: string;
    person_id?: string | null;
    start_ms: number;
    end_ms: number;
    text: string;
    final?: boolean;
    vocal?: VocalFeatures | null;
}
type LiveSegment = TranscriptUpdateSegment & {
    speech_final?: boolean;
    is_final?: boolean;
};
type StepAnchor = {
    speaker_id: string;
    timestamp_ms: number;
    acoustic_state: AcousticState | null;
    acoustic_change: AcousticChange | null;
};
/**
 * Fold B product object for Bob: diarized turns + vocal features.
 *
 * Live: feed Prosody wire events via `apply`. Batch: `Conversation.fromAnalysis`.
 * Logic mirrors the demo’s transcript merge / turn builder
 * (`website/.../session-utils.ts`) so Bob and the demo share one spine.
 */
export declare class Conversation {
    private segments;
    private steps;
    private profiles;
    private affectAvailable;
    private batch;
    static fromAnalysis(result: AnalysisResult): Conversation;
    /** Ingest one live Prosody event (`directive`, `transcript_update`, …). */
    apply(event: ProsodyEvent | Record<string, unknown>): this;
    getTranscript(): string;
    /** Diarized transcript turns with speaker_id (demo-equivalent spine). */
    getTurns(): ConversationTurn[];
    getTurn(index: number): ConversationTurn | null;
    /**
     * Vocal features for a turn (overlap-weighted best step) or latest step.
     * Pass `turnIndex` for a turn; omit for the most recent recurrent step.
     */
    getVocalFeatures(turnIndex?: number): VocalFeatures | null;
    getSpeakerProfiles(): SpeakerProfile[];
    getSpeakerProfile(speakerId: string): SpeakerProfile | null;
    getIdentity(speakerId: string): SpeakerIdentity | null;
    /** All gated recurrent windows (batch timeline or live directives). */
    getAcoustics(): AcousticWindow[];
    private batchTurn;
}
export declare function vocalFeaturesFromWindow(window: AcousticWindow): VocalFeatures | null;
export declare function vocalFeaturesFromState(state: AcousticState | null | undefined, change?: AcousticChange | null): VocalFeatures | null;
/** Port of demo `mergeTranscriptUpdateSegments`. */
export declare function mergeTranscriptUpdateSegments(current: LiveSegment[], incoming: TranscriptUpdateSegment[], resultId: string, isFinal: boolean, speechFinal?: boolean): LiveSegment[];
/** Port of demo `buildTurnsFromSegments` — speaker_id owns cuts; attach vocal. */
export declare function buildTurnsFromSegments(segments: LiveSegment[], steps: StepAnchor[]): ConversationTurn[];
export {};
