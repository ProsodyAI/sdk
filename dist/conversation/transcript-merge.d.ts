import type { TranscriptUpdateSegment } from '../types.js';
import { type LiveSegment } from './turn-model.js';
/** Port of demo `mergeTranscriptUpdateSegments`. */
export declare function mergeTranscriptUpdateSegments(current: LiveSegment[], incoming: TranscriptUpdateSegment[], resultId: string, isFinal: boolean, speechFinal?: boolean): LiveSegment[];
/** Port of demo `applySpeakerUpdateToSegments`. */
export declare function applySpeakerUpdateToSegments(segments: LiveSegment[], startMs: number, endMs: number, speakerId: string): LiveSegment[];
