import type { AnalysisEvent, AnalysisTurn } from '../types.js';

/**
 * One moment the model committed: what this span moved in the speaker.
 *
 * The magnitude is the model's own readout of how far the recurrent speaker
 * state travelled. It is computable only inside the model that has been
 * carrying the person's state, so this module reads the committed
 * `state_delta` event and never derives a significance of its own from
 * acoustic values.
 */
export interface Moment {
  /** Where the evidence began on the model's 80ms frame clock, in ms. */
  frameMs: number;
  /** Where the model committed the decision, in ms. */
  commitMs: number;
  /** How long the movement ran, in ms. */
  durationMs: number;
  /** How far the speaker's state moved, as the model committed it. */
  magnitude: number;
  /** True when the state returned to the speaker's prior trajectory. */
  resolved: boolean;
  /** The lane holding the floor where the evidence began. Null when no committed turn covers it. */
  speakerId: string | null;
}

function isStateDelta(
  event: AnalysisEvent,
): event is Extract<AnalysisEvent, { type: 'state_delta' }> {
  return event.type === 'state_delta';
}

/** The lane holding the floor at a frame, from the committed turn spans. */
function laneAt(turns: AnalysisTurn[], frameMs: number): string | null {
  for (const turn of turns) {
    if (frameMs >= turn.start_ms && frameMs < turn.end_ms) return turn.speaker_id;
  }
  return null;
}

/**
 * The committed state deltas as typed moments, in commit order.
 *
 * Attribution reads the committed turn spans: a moment carries the lane that
 * held the floor where its evidence began.
 */
export function momentsFromEvents(
  events: AnalysisEvent[] | null | undefined,
  turns: AnalysisTurn[] | null | undefined,
): Moment[] {
  const spans = turns ?? [];
  return (events ?? []).filter(isStateDelta).map((event) => ({
    frameMs: event.frame_ms,
    commitMs: event.commit_ms,
    durationMs: event.duration_ms,
    magnitude: event.magnitude,
    resolved: event.resolved,
    speakerId: laneAt(spans, event.frame_ms),
  }));
}

/** The same moments ordered by how far the state moved, largest first. */
export function byMagnitude(moments: Moment[]): Moment[] {
  return [...moments].sort((a, b) => b.magnitude - a.magnitude);
}
