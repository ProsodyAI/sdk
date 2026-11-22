import type { TranscriptUpdateSegment } from '../types.js';
import { type LiveSegment } from './turn-model.js';
/** Port of demo `mergeTranscriptUpdateSegments`. */
export declare function mergeTranscriptUpdateSegments(current: LiveSegment[], incoming: TranscriptUpdateSegment[], resultId: string, isFinal: boolean, speechFinal?: boolean): LiveSegment[];
/**
 * Apply one settled span from the second pass: drop the held segments whose
 * midpoint falls inside `[startMs, endMs)` and keep the revision's words,
 * all final, in their place.
 */
export declare function applyTranscriptRevisionToSegments(current: LiveSegment[], incoming: TranscriptUpdateSegment[], resultId: string, startMs: number, endMs: number): LiveSegment[];
/** Port of demo `applySpeakerUpdateToSegments`. */
export declare function applySpeakerUpdateToSegments(segments: LiveSegment[], startMs: number, endMs: number, speakerId: string): LiveSegment[];
