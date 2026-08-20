import type { Conversation } from './conversation.js';
import {
  measurementFromState,
  type MeasurementPath,
  type Prosody,
} from './conversation/prosody.js';
import type { Moment } from './conversation/moments.js';
import type { VoiceFrame, AffectVad } from './step.js';

export type { Prosody, ProsodyChange } from './conversation/prosody.js';
export type { Moment } from './conversation/moments.js';

/**
 * Options for {@link ProsodyClient.transcribe}.
 */
export interface TranscribeOptions {
  language?: string;
  sessionId?: string;
  /** Run speaker diarization: label who spoke when within the recording. Defaults to true. */
  diarize?: boolean;
  /**
   * Attach vocal measurement to each turn (`turn.prosody`).
   * Defaults to true: that is the product.
   */
  prosody?: boolean;
}

/** Median and spread of one measured feature across a speaker's frames. */
export interface VoiceStat {
  /** Median reading across the frames that supported this measurement. */
  median: number;
  /** Lowest reading. */
  min: number;
  /** Highest reading. */
  max: number;
  /** Frames that carried a measurable value. */
  count: number;
}

/** Intonation baseline across a speaker's frames. */
export interface IntonationBaseline {
  /** Median F0. Null when no frame was voiced. */
  pitch: VoiceStat | null;
  /** Pitch span. */
  range: VoiceStat | null;
  /** Contour direction. */
  slope: VoiceStat | null;
}

/** Stress baseline across a speaker's frames. */
export interface StressBaseline {
  /** Loudness. */
  loudness: VoiceStat | null;
  /** Peak intensity. */
  peak: VoiceStat | null;
}

/** Rhythm baseline across a speaker's frames. */
export interface RhythmBaseline {
  /** Fraction phonated. */
  voiced: VoiceStat | null;
  /** Fraction silent. */
  pause: VoiceStat | null;
  /** Phonation onsets per second. */
  onset: VoiceStat | null;
}

/**
 * A speaker's measured voice: the baseline everything speaker-relative is
 * measured against.
 *
 * These are physical measurements of that voice across the recording. Fields
 * are `null` when no frame supported the measurement (for example pitch on
 * audio with no voiced frames).
 */
export interface VoiceProfile {
  /** Intonation baseline. */
  intonation: IntonationBaseline;
  /** Stress baseline. */
  stress: StressBaseline;
  /** Rhythm baseline. */
  rhythm: RhythmBaseline;
  /** Voice quality baseline: spectral tilt. */
  tilt: VoiceStat | null;
  /** Frames measured for this speaker. */
  frameCount: number;
}

/**
 * One voice in this result.
 *
 * `id` is the identifier the API minted for this voice within this call.
 * Everything else in the response keys off it: turns, frames,
 * trajectories, deltas.
 *
 * Turns hold the same instance the result lists, so
 * `turn.speaker === transcription.speakers[0]` holds.
 */
export class Speaker {
  /** Speaker id, stable within this call. */
  readonly id: string;
  /** Diarization label (`Speaker 1`), ordered by first appearance in this result. */
  readonly label: string;
  /** Total attributed speaking time, in ms. */
  readonly talkMs: number;
  /**
   * This speaker's share of all attributed speaking time on the call, 0 to 1.
   * Zero when nobody was attributed any speaking time.
   */
  readonly talkShare: number;
  /** Number of transcript turns attributed to this speaker. */
  readonly turnCount: number;
  /** This voice's measured baseline across the recording. */
  readonly state: VoiceProfile;

  constructor(init: {
    id: string;
    label: string;
    talkMs: number;
    talkShare: number;
    turnCount: number;
    state: VoiceProfile;
  }) {
    this.id = init.id;
    this.label = init.label;
    this.talkMs = init.talkMs;
    this.talkShare = init.talkShare;
    this.turnCount = init.turnCount;
    this.state = init.state;
  }

  /** True when diarization could not attribute this audio. */
  get isUnknown(): boolean {
    return this.id === 'unknown';
  }

  /** Attributed speaking time, in seconds. */
  get talkSeconds(): number {
    return this.talkMs / 1000;
  }

  /** Display label. */
  toString(): string {
    return this.label;
  }

  /** Plain object form, for logging or JSON transport. */
  toJSON() {
    return {
      id: this.id,
      label: this.label,
      talkMs: this.talkMs,
      talkShare: this.talkShare,
      turnCount: this.turnCount,
      state: this.state,
    };
  }
}

/** One utterance: who said it, what they said, and how it sounded. */
export interface TranscribeTurn {
  /** The speaker who said this turn. */
  speaker: Speaker;
  /** The transcript text of the turn. */
  text: string;
  /** Start of the turn on the call clock, in ms. */
  startMs: number;
  /** End of the turn on the call clock, in ms. */
  endMs: number;
  /** How the voice sounded and moved on this turn. Present when `prosody` is on (the default). */
  prosody?: Prosody | null;
}

/**
 * Result of {@link ProsodyClient.transcribe}: the transcript, the speakers,
 * every measured frame, and the call-level affect.
 */
export interface Transcription {
  /** Full transcript text. */
  text: string;
  /** Diarized turns, in order. */
  turns: TranscribeTurn[];
  /** Speakers on this call, with their measured baselines. */
  speakers: Speaker[];
  /** Look up a speaker by id. */
  getSpeaker(id: string): Speaker | undefined;
  /** Turns belonging to one speaker. */
  turnsBySpeaker(speaker: Speaker | string): TranscribeTurn[];
  /** Every measured frame across the call, in order. */
  frames: VoiceFrame[];
  /** Committed `state_delta` moments, ordered by descending magnitude. */
  moments: Moment[];
  /** Emotional attributes (valence, arousal, dominance) for the call, when the checkpoint publishes them. */
  vad: AffectVad | null;
  /** Lower-level object for trajectories and deltas. */
  conversation: Conversation;
}

function speakerLabel(id: string, index: number): string {
  if (id === 'unknown') return 'Unknown speaker';
  return index >= 0 ? `Speaker ${index + 1}` : id;
}

function statOf(frames: VoiceFrame[], path: MeasurementPath): VoiceStat | null {
  const values: number[] = [];
  for (const frame of frames) {
    const value = measurementFromState(frame.getAcousticState(), path);
    if (value !== null) values.push(value);
  }
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
  return {
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    count: sorted.length,
  };
}

function voiceProfileOf(frames: VoiceFrame[]): VoiceProfile {
  return {
    intonation: {
      pitch: statOf(frames, 'intonation.pitch'),
      range: statOf(frames, 'intonation.range'),
      slope: statOf(frames, 'intonation.slope'),
    },
    stress: {
      loudness: statOf(frames, 'stress.loudness'),
      peak: statOf(frames, 'stress.peak'),
    },
    rhythm: {
      voiced: statOf(frames, 'rhythm.voiced'),
      pause: statOf(frames, 'rhythm.pause'),
      onset: statOf(frames, 'rhythm.onset'),
    },
    tilt: statOf(frames, 'tilt'),
    frameCount: frames.length,
  };
}

export function transcriptionFromConversation(
  conversation: Conversation,
  options?: TranscribeOptions,
): Transcription {
  const includeProsody = options?.prosody !== false;
  const rawTurns = conversation.getTurns();

  // Labels number speakers by when they first talk in the recording.
  const firstHeard = new Map<string, number>();
  for (const turn of rawTurns) {
    if (!firstHeard.has(turn.speaker_id)) firstHeard.set(turn.speaker_id, turn.start_ms);
  }
  const ordered = [...conversation.getSpeakers()].sort((a, b) => (
    (firstHeard.get(a.speaker_id) ?? Number.MAX_SAFE_INTEGER)
    - (firstHeard.get(b.speaker_id) ?? Number.MAX_SAFE_INTEGER)
  ));

  const totalTalkMs = ordered.reduce((total, entry) => total + Math.max(0, entry.talk_ms), 0);
  const shareOf = (talkMs: number): number => (
    totalTalkMs > 0 ? Math.max(0, talkMs) / totalTalkMs : 0
  );

  const speakers = ordered.map((entry, index) => new Speaker({
    id: entry.speaker_id,
    label: speakerLabel(entry.speaker_id, index),
    talkMs: entry.talk_ms,
    talkShare: shareOf(entry.talk_ms),
    turnCount: entry.turn_count,
    state: voiceProfileOf(conversation.getFrames(entry.speaker_id)),
  }));

  const byId = new Map(speakers.map((speaker) => [speaker.id, speaker]));
  const speakerFor = (id: string): Speaker => {
    const existing = byId.get(id);
    if (existing) return existing;
    // A turn can carry a label the speaker roll-up dropped (e.g. `unknown`).
    const created = new Speaker({
      id,
      label: speakerLabel(id, -1),
      talkMs: 0,
      talkShare: 0,
      turnCount: 0,
      state: voiceProfileOf(conversation.getFrames(id)),
    });
    byId.set(id, created);
    return created;
  };

  const turns: TranscribeTurn[] = rawTurns.map((turn) => {
    const base: TranscribeTurn = {
      speaker: speakerFor(turn.speaker_id),
      text: turn.text,
      startMs: turn.start_ms,
      endMs: turn.end_ms,
    };
    if (includeProsody) base.prosody = turn.prosody ?? null;
    return base;
  });

  return {
    text: conversation.getTranscript(),
    turns,
    speakers,
    getSpeaker: (id: string) => byId.get(id),
    turnsBySpeaker: (speaker: Speaker | string) => {
      const id = typeof speaker === 'string' ? speaker : speaker.id;
      return turns.filter((turn) => turn.speaker.id === id);
    },
    frames: conversation.getFrames(),
    moments: conversation.getTopMoments(),
    vad: conversation.getVad(),
    conversation,
  };
}
