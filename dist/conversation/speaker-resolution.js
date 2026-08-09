import { isKnownSpeaker, normalizeSpeakerId, overlapMs, } from './turn-model.js';
/**
 * Attribute unlabeled live segments from committed step readouts: first by
 * overlap with each step's window, then by bridging finalized runs whose
 * neighbors agree.
 */
export function resolveLiveSpeakers(segments, steps) {
    if (!segments.length)
        return segments;
    const resolved = segments.map((segment) => ({
        ...segment,
        speaker_id: normalizeSpeakerId(segment.speaker_id),
    }));
    for (const segment of resolved) {
        if (isKnownSpeaker(segment.speaker_id))
            continue;
        const segEnd = Math.max(segment.start_ms + 1, segment.end_ms);
        const overlapBySpeaker = new Map();
        for (const step of steps) {
            const speaker = normalizeSpeakerId(step.speaker_id);
            if (!isKnownSpeaker(speaker))
                continue;
            const overlap = overlapMs(segment.start_ms, segEnd, step.timestamp_ms, step.timestamp_ms + 1000);
            if (overlap > 0) {
                overlapBySpeaker.set(speaker, (overlapBySpeaker.get(speaker) ?? 0) + overlap);
            }
        }
        let bestId = 'unknown';
        let bestOverlap = 0;
        for (const [speaker, overlap] of overlapBySpeaker) {
            if (overlap > bestOverlap) {
                bestOverlap = overlap;
                bestId = speaker;
            }
        }
        if (bestOverlap > 0)
            segment.speaker_id = bestId;
    }
    for (let index = 0; index < resolved.length;) {
        if (isKnownSpeaker(resolved[index].speaker_id)) {
            index += 1;
            continue;
        }
        const runStart = index;
        while (index < resolved.length && !isKnownSpeaker(resolved[index].speaker_id)) {
            index += 1;
        }
        const left = resolved[runStart - 1];
        const right = resolved[index];
        const leftId = left ? normalizeSpeakerId(left.speaker_id) : 'unknown';
        const rightId = right ? normalizeSpeakerId(right.speaker_id) : 'unknown';
        const canBridge = (left?.is_final === true
            && right?.is_final === true
            && isKnownSpeaker(leftId)
            && leftId === rightId
            && resolved.slice(runStart, index).every((segment) => segment.is_final === true));
        if (canBridge) {
            for (let unknownIndex = runStart; unknownIndex < index; unknownIndex += 1) {
                resolved[unknownIndex].speaker_id = leftId;
            }
        }
    }
    return resolved;
}
