import { type LiveSegment, type StepAnchor } from './turn-model.js';
/**
 * Attribute unlabeled live segments from committed step readouts: first by
 * overlap with each step's span, then by bridging finalized runs whose
 * neighbors agree.
 */
export declare function resolveLiveSpeakers(segments: LiveSegment[], steps: StepAnchor[]): LiveSegment[];
