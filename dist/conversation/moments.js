function isStateDelta(event) {
    return event.type === 'state_delta';
}
/** The lane holding the floor at a frame, from the committed turn spans. */
function laneAt(turns, frameMs) {
    for (const turn of turns) {
        if (frameMs >= turn.start_ms && frameMs < turn.end_ms)
            return turn.speaker_id;
    }
    return null;
}
function toMoment(delta, turns) {
    return {
        frameMs: delta.frame_ms,
        commitMs: delta.commit_ms,
        durationMs: delta.duration_ms,
        magnitude: delta.magnitude,
        resolved: delta.resolved,
        speakerId: laneAt(turns, delta.frame_ms),
    };
}
/**
 * The batch report's committed state deltas as typed moments, in commit order.
 *
 * Attribution reads the committed turn spans: a moment carries the lane that
 * held the floor where its evidence began.
 */
export function momentsFromEvents(events, turns) {
    const spans = turns ?? [];
    return (events ?? []).filter(isStateDelta).map((event) => toMoment(event, spans));
}
/** The live wire's committed state deltas as typed moments, in arrival order. */
export function momentsFromStateDeltas(deltas, turns) {
    const spans = turns ?? [];
    return (deltas ?? []).map((delta) => toMoment(delta, spans));
}
/** Moments sorted by descending magnitude. */
export function byMagnitude(moments) {
    return [...moments].sort((a, b) => b.magnitude - a.magnitude);
}
