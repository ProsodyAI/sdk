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
/**
 * The batch report's committed state deltas as typed moments, in commit order.
 *
 * Attribution reads the committed turn spans: a moment carries the lane that
 * held the floor where its evidence began.
 */
export declare function momentsFromEvents(events: AnalysisEvent[] | null | undefined, turns: TurnSpan[] | null | undefined): Moment[];
/** The live wire's committed state deltas as typed moments, in arrival order. */
export declare function momentsFromStateDeltas(deltas: StateDeltaEvent[] | null | undefined, turns: TurnSpan[] | null | undefined): Moment[];
/** Moments sorted by descending magnitude. */
export declare function byMagnitude(moments: Moment[]): Moment[];
