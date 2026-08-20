import type { AnalysisEvent, StateDeltaEvent } from '../types.js';

/**
 * One committed `state_delta` event, attributed to a lane.
 *
 * The magnitude is the model's readout of how far the recurrent speaker
 * state moved over this span. It is computable only inside the model that
 * has been carrying the person's state, so this module parses the committed
 * event and adds lane attribution.
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

/** The turn fields used to attribute a moment. Batch and live turns both carry them. */
export interface TurnSpan {
  start_ms: number;
  end_ms: number;
  speaker_id: string;
}

/** The committed shape shared by the batch event and the live event. */
interface CommittedDelta {
  frame_ms: number;
  commit_ms: number;
  duration_ms: number;
  magnitude: number;
  resolved: boolean;
}

function isStateDelta(
  event: AnalysisEvent,
): event is Extract<AnalysisEvent, { type: 'state_delta' }> {
  return event.type === 'state_delta';
}

/** The lane holding the floor at a frame, from the committed turn spans. */
function laneAt(turns: TurnSpan[], frameMs: number): string | null {
  for (const turn of turns) {
    if (frameMs >= turn.start_ms && frameMs < turn.end_ms) return turn.speaker_id;
  }
  return null;
}

function toMoment(delta: CommittedDelta, turns: TurnSpan[]): Moment {
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
export function momentsFromEvents(
  events: AnalysisEvent[] | null | undefined,
  turns: TurnSpan[] | null | undefined,
): Moment[] {
  const spans = turns ?? [];
  return (events ?? []).filter(isStateDelta).map((event) => toMoment(event, spans));
}

/** The live wire's committed state deltas as typed moments, in arrival order. */
export function momentsFromStateDeltas(
  deltas: StateDeltaEvent[] | null | undefined,
  turns: TurnSpan[] | null | undefined,
): Moment[] {
  const spans = turns ?? [];
  return (deltas ?? []).map((delta) => toMoment(delta, spans));
}

/** Moments sorted by descending magnitude. */
export function byMagnitude(moments: Moment[]): Moment[] {
  return [...moments].sort((a, b) => b.magnitude - a.magnitude);
}
