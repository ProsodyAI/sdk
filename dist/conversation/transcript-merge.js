import { isKnownSpeaker, normalizeSpeakerId, overlapMs, } from './turn-model.js';
/**
 * Merge one `transcript_update` into the held segments.
 *
 * Without a result id the update is appended. With one, an interim replaces
 * the unsettled segments sharing the id, and a final replaces the unsettled
 * segments plus the exact spans it re-emits. A committed span survives a
 * later update that reuses its result id: dropping every span sharing the id
 * erased words already on screen whenever the producer reused one.
 */
export function mergeTranscriptUpdateSegments(current, incoming, resultId, isFinal, speechFinal = false) {
    const closesSpeech = isFinal && speechFinal;
    const lastIncomingIndex = incoming.length - 1;
    const nextSegments = incoming.map((segment, index) => ({
        ...segment,
        speaker_id: normalizeSpeakerId(segment.speaker_id),
        result_id: resultId || segment.result_id,
        is_final: isFinal,
        speech_final: closesSpeech && index === lastIncomingIndex,
    }));
    if (!resultId)
        return [...current, ...nextSegments];
    const existingFinal = current.some((segment) => segment.result_id === resultId && segment.is_final);
    if (existingFinal && !isFinal)
        return current;
    const incomingSpans = new Set(nextSegments.map((segment) => `${segment.start_ms}:${segment.end_ms}`));
    const retained = current.filter((segment) => {
        if (segment.result_id !== resultId)
            return true;
        if (!segment.is_final)
            return false;
        return !incomingSpans.has(`${segment.start_ms}:${segment.end_ms}`);
    });
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
export function applyTranscriptRevisionToSegments(current, incoming, resultId, startMs, endMs) {
    if (endMs <= startMs)
        return current;
    const retained = current.filter((segment) => {
        const midpoint = Math.floor((segment.start_ms + segment.end_ms) / 2);
        return midpoint < startMs || midpoint >= endMs;
    });
    const revised = incoming.map((segment) => ({
        ...segment,
        speaker_id: normalizeSpeakerId(segment.speaker_id),
        result_id: resultId || segment.result_id,
        is_final: true,
        speech_final: false,
    }));
    return [...retained, ...revised].sort((a, b) => a.start_ms - b.start_ms || a.end_ms - b.end_ms);
}
/**
 * Relabel the segments a committed speaker span covers. A segment the model
 * already committed to a speaker (`speaker_committed`) keeps its label; any
 * other segment the span overlaps by a quarter of its length, or by 200 ms,
 * takes the span's speaker and is committed.
 */
export function applySpeakerUpdateToSegments(segments, startMs, endMs, speakerId) {
    const resolved = normalizeSpeakerId(speakerId);
    if (!isKnownSpeaker(resolved) || !segments.length)
        return segments;
    const spanEnd = Math.max(startMs + 1, endMs);
    let changed = false;
    const next = segments.map((segment) => {
        if (segment.speaker_committed)
            return segment;
        const segEnd = Math.max(segment.start_ms + 1, segment.end_ms);
        const overlap = overlapMs(segment.start_ms, segEnd, startMs, spanEnd);
        const duration = Math.max(1, segEnd - segment.start_ms);
        if (overlap < duration * 0.25 && overlap < 200)
            return segment;
        changed = true;
        return { ...segment, speaker_id: resolved, speaker_committed: true };
    });
    return changed ? next : segments;
}
/**
 * Re-apply every committed span to the segments on hand. A span's verdict and
 * the words inside it arrive on separate cadences, so words for an
 * already-decided span can land after its commit.
 */
export function applyCommittedSpans(segments, spans) {
    let next = segments;
    for (const span of spans) {
        next = applySpeakerUpdateToSegments(next, span.startMs, span.endMs, span.speakerId);
    }
    return next;
}
