import type { AcousticChange, AcousticState, TranscriptUpdateSegment } from '../types.js';
import type { VocalFeatures } from './vocal-features.js';

/** One diarized transcript turn with the covering acoustic measurement. */
export interface ConversationTurn {
  speaker_id: string;
  start_ms: number;
  end_ms: number;
  text: string;
  final?: boolean;
  vocal?: VocalFeatures | null;
}

export type LiveSegment = TranscriptUpdateSegment & {
  speech_final?: boolean;
  is_final?: boolean;
};

/** One recurrent step's committed readout, anchored on the audio clock. */
export type StepAnchor = {
  speaker_id: string;
  timestamp_ms: number;
  acoustic_state: AcousticState | null;
  acoustic_change: AcousticChange | null;
};

export function normalizeSpeakerId(id: string | undefined | null): string {
  const value = (id ?? '').trim();
  return value || 'unknown';
}

export function isKnownSpeaker(id: string | undefined | null): boolean {
  return normalizeSpeakerId(id) !== 'unknown';
}

export function overlapMs(startA: number, endA: number, startB: number, endB: number): number {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}
