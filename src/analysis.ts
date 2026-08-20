import {
  measurementFromState,
  type MeasurementPath,
  type Prosody,
} from './conversation/prosody.js';
import {
  byMagnitude,
  momentsFromEvents,
  type Moment,
} from './conversation/moments.js';
import {
  VoiceFrame,
  type AffectVad,
} from './step.js';
import type {
  AnalysisResult,
  AnalysisTurn,
  DiarizedSpeaker,
  ProsodyTimelinePoint,
} from './types.js';

/** One measured value on the call clock, attributed to a speaker. */
export interface MeasurementPoint {
  /** Start of the measured frame, in ms. */
  startMs: number;
  /** End of the measured frame, in ms. */
  endMs: number;
  /** Conversation-local lane this point was attributed to. */
  speakerId: string;
  /** The measured value. */
  value: number;
}

/** One speaker-relative movement, with the baseline it was judged against. */
export interface ChangePoint {
  /** Start of the frame, in ms. */
  startMs: number;
  /** End of the frame, in ms. */
  endMs: number;
  /** Conversation-local lane this change was attributed to. */
  speakerId: string;
  /** Baseline label the change was measured against, when the wire carries one. */
  reference: string | null;
  /** The committed movement, in the same family shape as `state`. */
  values: NonNullable<Prosody['change']>;
}

/**
 * Validate the stable batch envelope.
 *
 * ProsodySSM's product output is `acoustic_state`, the measured waveform
 * values per frame, which arrives on `prosody_timeline` and on each turn.
 * Valence / arousal / dominance are the trained affect head's readout; each
 * is `null` on an unvoiced frame, never a fabricated neutral. The head is
 * always trained, so a deployment that publishes only acoustic state is
 * still a correct deployment.
 */
export function parseAnalysisResult(value: unknown): AnalysisResult {
  if (!isRecord(value)) {
    throw new Error('Analysis result must be a JSON object');
  }
  if (typeof value.prediction_id !== 'string' || !value.prediction_id) {
    throw new Error('Analysis result missing prediction_id');
  }
  if (typeof value.text !== 'string') {
    throw new Error('Analysis result missing text');
  }
  if (!isRecord(value.prosody)) {
    throw new Error('Analysis result missing prosody');
  }
  if (typeof value.duration !== 'number' || typeof value.word_count !== 'number') {
    throw new Error('Analysis result missing audio metadata');
  }

  return value as unknown as AnalysisResult;
}

/**
 * Consumer view of one analyzed recording.
 *
 * Accessors over the measured acoustic timeline, transcript, and recording-local
 * committed identity lanes. Persistent identity lives under `client.speakers`.
 */
export class ConversationAnalysis {
  private readonly result: AnalysisResult;

  constructor(data: AnalysisResult) {
    this.result = data;
  }

  /** Full transcript text. */
  getTranscript(): string {
    return this.result.text;
  }

  /** Diarized turns, in order. */
  getTurns(): AnalysisTurn[] {
    return [...(this.result.turns ?? [])];
  }

  /** One turn by index, or null when out of range. */
  getTurn(index: number): AnalysisTurn | null {
    if (!Number.isInteger(index) || index < 0) return null;
    return this.result.turns?.[index] ?? null;
  }

  /** Recording-local speakers with talk time and turn counts. */
  getSpeakers(): DiarizedSpeaker[] {
    return recordingSpeakers(this.result);
  }

  /** Measured frames produced from Mimi-latent recurrent analysis. */
  getFrames(speakerId?: string): VoiceFrame[] {
    return voiceFrames(this.result)
      .filter((point) => speakerId === undefined || point.speaker_id === speakerId)
      .map((point) => VoiceFrame.fromTimelinePoint(point));
  }

  /** One frame by index, or null when out of range. */
  getVoiceFrame(index: number): VoiceFrame | null {
    const frames = this.getFrames();
    if (!Number.isInteger(index) || index < 0 || index >= frames.length) return null;
    return frames[index] ?? null;
  }

  /** One physical measurement across the recording, optionally for one speaker. */
  getMeasurementSeries(path: MeasurementPath, speakerId?: string): MeasurementPoint[] {
    return this.getFrames(speakerId).flatMap((frame) => {
      const value = measurementFromState(frame.getAcousticState(), path);
      return value === null ? [] : [{
        startMs: frame.startMs,
        endMs: frame.endMs,
        speakerId: frame.speakerId,
        value,
      }];
    });
  }

  /** Speaker-relative changes. The first frame in each speaker lane has none. */
  getChanges(speakerId?: string): ChangePoint[] {
    return this.getFrames(speakerId).flatMap((frame) => {
      const delta = frame.getChange();
      if (!delta) return [];
      return [{
        startMs: frame.startMs,
        endMs: frame.endMs,
        speakerId: frame.speakerId,
        reference: delta.reference,
        values: delta.values,
      }];
    });
  }

  /**
   * Committed `state_delta` moments, in commit order. Each carries the
   * magnitude the model published. Empty when the deployment committed none.
   */
  getMoments(speakerId?: string): Moment[] {
    return momentsFromEvents(this.result.events, this.result.turns).filter(
      (moment) => speakerId === undefined || moment.speakerId === speakerId,
    );
  }

  /** Committed moments sorted by descending magnitude. */
  getTopMoments(limit = 10, speakerId?: string): Moment[] {
    return byMagnitude(this.getMoments(speakerId)).slice(0, Math.max(0, limit));
  }

  /** The measurement bundle on the latest (or indexed) frame. */
  getProsody(frameIndex?: number): Prosody | null {
    if (frameIndex === undefined) {
      const frames = this.getFrames();
      return frames[frames.length - 1]?.getProsody() ?? null;
    }
    return this.getVoiceFrame(frameIndex)?.getProsody() ?? null;
  }

  /**
   * The emotional attributes (valence, arousal, dominance) for the whole
   * file. Each component is `null` on an unvoiced frame; the head is always
   * trained. Null when every dimension is null.
   */
  getVad(): AffectVad | null {
    const { valence, arousal, dominance } = this.result.prosody;
    if (valence == null && arousal == null && dominance == null) return null;
    return { valence, arousal, dominance };
  }

  /** Valence for the whole file, or for one turn. Null on an unvoiced frame. */
  getValence(turnIndex?: number): number | null {
    if (turnIndex === undefined) return finiteOrNull(this.result.prosody.valence);
    return finiteOrNull(this.getTurn(turnIndex)?.prosody?.valence ?? null);
  }

  /** Raw API timeline for consumers that need the wire shape. */
  getTimeline(): ProsodyTimelinePoint[] {
    return [...(this.result.prosody_timeline ?? [])];
  }
}

function recordingSpeakers(result: AnalysisResult): DiarizedSpeaker[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const turnCounts = new Map<string, number>();
  const turnDurations = new Map<string, number>();
  const frameCounts = new Map<string, number>();
  const add = (speakerId: string | undefined): void => {
    if (speakerId && !seen.has(speakerId)) {
      seen.add(speakerId);
      ids.push(speakerId);
    }
  };

  for (const turn of result.turns ?? []) {
    add(turn.speaker_id);
    turnCounts.set(turn.speaker_id, (turnCounts.get(turn.speaker_id) ?? 0) + 1);
    turnDurations.set(
      turn.speaker_id,
      (turnDurations.get(turn.speaker_id) ?? 0) + Math.max(0, turn.end_ms - turn.start_ms),
    );
  }
  for (const speaker of result.per_speaker ?? []) add(speaker.speaker_id);
  for (const speakerId of result.diarization?.speakers ?? []) add(speakerId);
  for (const point of result.prosody_timeline ?? []) {
    add(point.speaker_id);
    if (point.speaker_id) {
      frameCounts.set(point.speaker_id, (frameCounts.get(point.speaker_id) ?? 0) + 1);
    }
  }

  const summaries = new Map(
    (result.per_speaker ?? []).map((speaker) => [speaker.speaker_id, speaker]),
  );
  return ids.map((speakerId) => {
    const summary = summaries.get(speakerId);
    return {
      speaker_id: speakerId,
      talk_ms: summary?.talk_ms ?? turnDurations.get(speakerId) ?? 0,
      turn_count: turnCounts.get(speakerId) ?? 0,
      window_count: summary?.window_count ?? frameCounts.get(speakerId) ?? 0,
    };
  });
}

/**
 * The measured frames of a call, in order.
 *
 * Empty when the upload was not diarized (`diarize: false`), since the timeline
 * is only built for a diarized call.
 */
export function voiceFrames(result: AnalysisResult): ProsodyTimelinePoint[] {
  return (result.prosody_timeline ?? []).filter((point) => point.acoustic_state != null);
}

/**
 * Read one measurement across a call, skipping frames where it was not
 * measurable (an unvoiced frame carries `null` pitch, without any floor value).
 */
export function measurementSeries(
  result: AnalysisResult,
  path: MeasurementPath,
): { start_ms: number; end_ms: number; speaker_id?: string; value: number }[] {
  const series: { start_ms: number; end_ms: number; speaker_id?: string; value: number }[] = [];
  for (const point of voiceFrames(result)) {
    const value = measurementFromState(point.acoustic_state ?? null, path);
    if (value !== null) {
      series.push({
        start_ms: point.start_ms,
        end_ms: point.end_ms,
        speaker_id: point.speaker_id,
        value,
      });
    }
  }
  return series;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
