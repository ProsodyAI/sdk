import type { TranscriptUpdateSegment } from '../types.js';
import { type LiveSegment } from './turn-model.js';
/**
 * Merge one `transcript_update` into the held segments.
 *
 * Without a result id the update is appended. With one, an interim replaces
 * the unsettled segments sharing the id, and a final replaces the unsettled
 * segments plus the exact spans it re-emits. A committed span survives a
 * later update that reuses its result id: dropping every span sharing the id
 * erased words already on screen whenever the producer reused one.
 */
export declare function mergeTranscriptUpdateSegments(current: LiveSegment[], incoming: LiveSegment[], resultId: string, isFinal: boolean, speechFinal?: boolean): LiveSegment[];
/**
 * Apply one settled span from the second pass: drop the held segments whose
 * midpoint falls inside `[startMs, endMs)` and keep the revision's words,
 * all final, in their place.
 */
export declare function applyTranscriptRevisionToSegments(current: LiveSegment[], incoming: TranscriptUpdateSegment[], resultId: string, startMs: number, endMs: number): LiveSegment[];
/**
 * Relabel the segments a committed speaker span covers. A segment the model
 * already committed to a speaker (`speaker_committed`) keeps its label; any
 * other segment the span overlaps by a quarter of its length, or by 200 ms,
 * takes the span's speaker and is committed.
 */
export declare function applySpeakerUpdateToSegments(segments: LiveSegment[], startMs: number, endMs: number, speakerId: string): LiveSegment[];
/** A committed speaker span on the session clock. */
export type CommittedSpan = {
    startMs: number;
    endMs: number;
    speakerId: string;
};
/**
 * Re-apply every committed span to the segments on hand. A span's verdict and
 * the words inside it arrive on separate cadences, so words for an
 * already-decided span can land after its commit.
 */
export declare function applyCommittedSpans(segments: LiveSegment[], spans: readonly CommittedSpan[]): LiveSegment[];
