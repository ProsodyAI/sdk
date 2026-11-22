import type { TranscriptUpdateSegment } from '../types.js';
import {
  isKnownSpeaker,
  normalizeSpeakerId,
  overlapMs,
  type LiveSegment,
} from './turn-model.js';

/** Port of demo `mergeTranscriptUpdateSegments`. */
export function mergeTranscriptUpdateSegments(
  current: LiveSegment[],
  incoming: TranscriptUpdateSegment[],
  resultId: string,
  isFinal: boolean,
  speechFinal = false,
): LiveSegment[] {
  const closesSpeech = isFinal && speechFinal;
  const lastIncomingIndex = incoming.length - 1;
  const nextSegments: LiveSegment[] = incoming.map((segment, index) => ({
    ...segment,
    speaker_id: normalizeSpeakerId(segment.speaker_id),
    result_id: resultId || segment.result_id,
    is_final: isFinal,
    speech_final: closesSpeech && index === lastIncomingIndex,
  }));
  if (!resultId) return [...current, ...nextSegments];
  const existingFinal = current.some(
    (segment) => segment.result_id === resultId && segment.is_final,
  );
  if (existingFinal && !isFinal) return current;
  const retained = current.filter((segment) => segment.result_id !== resultId);
  if (!nextSegments.length && closesSpeech && retained.length) {
    const withEndpoint = [...retained];
    withEndpoint[withEndpoint.length - 1] = {
      ...withEndpoint[withEndpoint.length - 1],
      speech_final: true,
    };
    return withEndpoint;
  }
  return [...retained, ...nextSegments];
}

/**
 * Apply one settled span from the second pass: drop the held segments whose
 * midpoint falls inside `[startMs, endMs)` and keep the revision's words,
 * all final, in their place.
 */
export function applyTranscriptRevisionToSegments(
  current: LiveSegment[],
  incoming: TranscriptUpdateSegment[],
  resultId: string,
  startMs: number,
  endMs: number,
): LiveSegment[] {
  if (endMs <= startMs) return current;
  const retained = current.filter((segment) => {
    const midpoint = Math.floor((segment.start_ms + segment.end_ms) / 2);
    return midpoint < startMs || midpoint >= endMs;
  });
  const revised: LiveSegment[] = incoming.map((segment) => ({
    ...segment,
    speaker_id: normalizeSpeakerId(segment.speaker_id),
    result_id: resultId || segment.result_id,
    is_final: true,
    speech_final: false,
  }));
  return [...retained, ...revised].sort(
    (a, b) => a.start_ms - b.start_ms || a.end_ms - b.end_ms,
  );
}

/** Port of demo `applySpeakerUpdateToSegments`. */
export function applySpeakerUpdateToSegments(
  segments: LiveSegment[],
  startMs: number,
  endMs: number,
  speakerId: string,
): LiveSegment[] {
  const resolved = normalizeSpeakerId(speakerId);
  if (!isKnownSpeaker(resolved) || !segments.length) return segments;
  const spanEnd = Math.max(startMs + 1, endMs);
  let changed = false;
  const next = segments.map((segment) => {
    if (isKnownSpeaker(segment.speaker_id)) return segment;
    const segEnd = Math.max(segment.start_ms + 1, segment.end_ms);
    const overlap = overlapMs(segment.start_ms, segEnd, startMs, spanEnd);
    const duration = Math.max(1, segEnd - segment.start_ms);
    if (overlap < duration * 0.25 && overlap < 200) return segment;
    changed = true;
    return { ...segment, speaker_id: resolved };
  });
  return changed ? next : segments;
}
