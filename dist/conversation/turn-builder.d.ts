import { type ConversationTurn, type LiveSegment, type StepAnchor } from './turn-model.js';
/** Build speaker-owned turns and attach overlapping vocal measurements. */
export declare function buildTurnsFromSegments(segments: LiveSegment[], steps: StepAnchor[]): ConversationTurn[];
