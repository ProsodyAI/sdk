import { resolveLiveSpeakers } from './speaker-resolution.js';
import { isKnownSpeaker, normalizeSpeakerId, overlapMs, } from './turn-model.js';
import { prosodyFromState } from './prosody.js';
/** Build speaker-owned turns and attach overlapping vocal measurements. */
export function buildTurnsFromSegments(segments, steps) {
    const sorted = resolveLiveSpeakers(segments, steps)
        .map((segment) => ({ ...segment }))
        .sort((a, b) => a.start_ms - b.start_ms || a.end_ms - b.end_ms);
    const prosodyAt = (startMs, endMs) => {
        let best = null;
        let bestOverlap = 0;
        for (const step of steps) {
            const overlap = overlapMs(startMs, endMs, step.timestamp_ms, step.timestamp_ms + 1000);
            if (overlap > bestOverlap) {
                bestOverlap = overlap;
                best = step;
            }
        }
        if (!best?.acoustic_state)
            return null;
        return prosodyFromState(best.acoustic_state, best.acoustic_change);
    };
    const turns = [];
    for (const seg of sorted) {
        const text = seg.text.trim();
        if (!text)
            continue;
        const speakerId = normalizeSpeakerId(seg.speaker_id);
        const last = turns[turns.length - 1];
        const speakerChanged = Boolean(last && last.speaker_id !== speakerId);
        const unknownInterim = seg.is_final === false && !isKnownSpeaker(speakerId);
        const shouldStartNew = !last || (speakerChanged && !unknownInterim);
        if (!shouldStartNew && last) {
            last.text = `${last.text} ${text}`.trim();
            last.end_ms = Math.max(last.end_ms, seg.end_ms);
            last.final = seg.is_final === true;
            if (!last.prosody)
                last.prosody = prosodyAt(last.start_ms, last.end_ms);
            continue;
        }
        turns.push({
            speaker_id: speakerId,
            start_ms: seg.start_ms,
            end_ms: seg.end_ms,
            text,
            final: seg.is_final === true,
            prosody: prosodyAt(seg.start_ms, Math.max(seg.start_ms + 1, seg.end_ms)),
        });
    }
    return turns;
}
