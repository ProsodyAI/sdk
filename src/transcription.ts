import type { Conversation } from './conversation.js';
import {
  type MeasurementName,
  type Prosody,
} from './conversation/prosody.js';
import type { AcousticWindow } from './step.js';

export type { Prosody, ProsodyChange } from './conversation/prosody.js';

/**
 * Options for {@link ProsodyClient.transcribe}.
 */
export interface TranscribeOptions {
  language?: string;
  sessionId?: string;
  /** Label speakers within the recording. Defaults to true. */
  diarize?: boolean;
  /**
   * Attach vocal measurement to each turn (`turn.prosody`).
   * Defaults to true: that is the product.
   */
  prosody?: boolean;
}

/** Median and spread of one measured feature across a speaker's audio. */
export interface VoiceStat {
  median: number;
  min: number;
  max: number;
  /** Windows that carried a measurable value. */
  count: number;
}

/**
 * A speaker's measured voice: the baseline everything speaker-relative is
 * measured against.
 *
 * These are physical measurements of that voice across the recording. Fields
 * are `null` when no window supported the measurement (for example pitch on
 * audio with no voiced frames). No embedding or voiceprint vector is exposed.
 */
export interface VoiceProfile {
  loudnessDbfs: VoiceStat | null;
  pitchHz: VoiceStat | null;
  pitchRangeSemitones: VoiceStat | null;
  tiltDbPerOctave: VoiceStat | null;
  voicedRatio: VoiceStat | null;
  pauseRatio: VoiceStat | null;
  /** Windows measured for this speaker. */
  windowCount: number;
  /** Whether pitch was measurable at all. */
  pitchAvailable: boolean;
}

/**
 * One voice in this result.
 *
 * `id` is the identifier the API minted for this voice within this call.
 * Everything else in the response keys off it: turns, acoustic windows,
 * trajectories, deltas.
 *
 * Turns hold the same instance the result lists, so
 * `turn.speaker === transcription.speakers[0]` holds.
 */
export class Speaker {
  /** Speaker id, stable within this call. */
  readonly id: string;
  /** Display label (`Speaker 1`), ordered by first appearance in this result. */
  readonly label: string;
  readonly talkMs: number;
  readonly turnCount: number;
  /** This voice's measured baseline across the recording. */
  readonly voice: VoiceProfile;

  constructor(init: {
    id: string;
    label: string;
    talkMs: number;
    turnCount: number;
    voice: VoiceProfile;
  }) {
    this.id = init.id;
    this.label = init.label;
    this.talkMs = init.talkMs;
    this.turnCount = init.turnCount;
    this.voice = init.voice;
  }

  /** True when diarization could not attribute this audio. */
  get isUnknown(): boolean {
    return this.id === 'unknown';
  }

  get talkSeconds(): number {
    return this.talkMs / 1000;
  }

  toString(): string {
    return this.label;
  }

  toJSON() {
    return {
      id: this.id,
      label: this.label,
      talkMs: this.talkMs,
      turnCount: this.turnCount,
      voice: this.voice,
    };
  }
}

/** One utterance: who said it, what they said, and how it sounded. */
export interface TranscribeTurn {
  speaker: Speaker;
  text: string;
  startMs: number;
  endMs: number;
  /** Present when `prosody` is on (the default). */
  prosody?: Prosody | null;
}

/**
 * Result of {@link ProsodyClient.transcribe}.
 *
 * `conversation` is the lower-level object for trajectories and deltas.
 */
export interface Transcription {
  text: string;
  turns: TranscribeTurn[];
  speakers: Speaker[];
  /** Look up a speaker by id. */
  getSpeaker(id: string): Speaker | undefined;
  /** Turns belonging to one speaker. */
  turnsBySpeaker(speaker: Speaker | string): TranscribeTurn[];
  conversation: Conversation;
}

function speakerLabel(id: string, index: number): string {
  if (id === 'unknown') return 'Unknown speaker';
  return index >= 0 ? `Speaker ${index + 1}` : id;
}

function statOf(windows: AcousticWindow[], name: MeasurementName): VoiceStat | null {
  const values: number[] = [];
  for (const window of windows) {
    const value = window.getMeasurement(name);
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

function voiceProfileOf(windows: AcousticWindow[]): VoiceProfile {
  const pitchHz = statOf(windows, 'pitchHz');
  return {
    loudnessDbfs: statOf(windows, 'loudnessDbfs'),
    pitchHz,
    pitchRangeSemitones: statOf(windows, 'pitchRangeSemitones'),
    tiltDbPerOctave: statOf(windows, 'tiltDbPerOctave'),
    voicedRatio: statOf(windows, 'voicedRatio'),
    pauseRatio: statOf(windows, 'pauseRatio'),
    windowCount: windows.length,
    pitchAvailable: pitchHz !== null,
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

  const speakers = ordered.map((entry, index) => new Speaker({
    id: entry.speaker_id,
    label: speakerLabel(entry.speaker_id, index),
    talkMs: entry.talk_ms,
    turnCount: entry.turn_count,
    voice: voiceProfileOf(conversation.getAcoustics(entry.speaker_id)),
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
      turnCount: 0,
      voice: voiceProfileOf(conversation.getAcoustics(id)),
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
    conversation,
  };
}
