import { isKnownSpeaker, normalizeSpeakerId, overlapMs, } from './turn-model.js';
/** Port of demo `mergeTranscriptUpdateSegments`. */
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
/** Port of demo `applySpeakerUpdateToSegments`. */
export function applySpeakerUpdateToSegments(segments, startMs, endMs, speakerId) {
    const resolved = normalizeSpeakerId(speakerId);
    if (!isKnownSpeaker(resolved) || !segments.length)
        return segments;
    const spanEnd = Math.max(startMs + 1, endMs);
    let changed = false;
    const next = segments.map((segment) => {
        if (isKnownSpeaker(segment.speaker_id))
            return segment;
        const segEnd = Math.max(segment.start_ms + 1, segment.end_ms);
        const overlap = overlapMs(segment.start_ms, segEnd, startMs, spanEnd);
        const duration = Math.max(1, segEnd - segment.start_ms);
        if (overlap < duration * 0.25 && overlap < 200)
            return segment;
        changed = true;
        return { ...segment, speaker_id: resolved };
    });
    return changed ? next : segments;
}
