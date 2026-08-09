import type { AcousticChange, AcousticState, TranscriptUpdateSegment } from '../types.js';
import type { VocalFeatures } from './vocal-features.js';
/** One diarized transcript turn with the covering acoustic measurement. */
export interface ConversationTurn {
    speaker_id: string;
    start_ms: number;
    end_ms: number;
    text: string;
    final?: boolean;
    vocal?: VocalFeatures | null;
}
export type LiveSegment = TranscriptUpdateSegment & {
    speech_final?: boolean;
    is_final?: boolean;
};
/** One recurrent step's committed readout, anchored on the audio clock. */
export type StepAnchor = {
    speaker_id: string;
    timestamp_ms: number;
    acoustic_state: AcousticState | null;
    acoustic_change: AcousticChange | null;
};
export declare function normalizeSpeakerId(id: string | undefined | null): string;
export declare function isKnownSpeaker(id: string | undefined | null): boolean;
export declare function overlapMs(startA: number, endA: number, startB: number, endB: number): number;
