import { type ConversationTurn, type LiveSegment, type StepAnchor } from './turn-model.js';
/** Build speaker-owned turns and attach overlapping vocal measurements.
 *
 * When the model has committed ``turn_boundary`` edges, those are the
 * utterance cuts. Otherwise a committed speaker change opens a turn.
 */
export declare function buildTurnsFromSegments(segments: LiveSegment[], steps: StepAnchor[], turnBoundaries?: number[]): ConversationTurn[];
