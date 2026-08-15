import {
  prosodyChangeFromWire,
  prosodyDeltaFromWire,
  prosodyFromState,
  prosodyStateFromWire,
  type Prosody,
  type ProsodyChange,
  type ProsodyDelta,
  type ProsodyState,
} from './conversation/prosody.js';
import type {
  AcousticChange,
  AcousticState,
  DirectiveEvent,
  ProsodyTimelinePoint,
} from './types.js';

/**
 * Measured valence, arousal, and dominance for one frame or call.
 *
 * The affect head is always trained. Each component is a signed reading on
 * the model's affect scale, or `null` on an unvoiced frame.
 */
export interface AffectVad {
  /** Valence: pleasant to unpleasant. Null on an unvoiced frame. */
  valence: number | null;
  /** Arousal: calm to activated. Null on an unvoiced frame. */
  arousal: number | null;
  /** Dominance: submissive to dominant. Null on an unvoiced frame. */
  dominance: number | null;
}

/**
 * One measured interval of a call, as a consumer sees it.
 *
 * Built from a live `directive` event or a batch `prosody_timeline` window.
 * Raw Mimi latents and recurrent state tensors stay internal; this surface
 * carries only the readouts: who spoke, when, how the voice sounded, how it
 * moved against that speaker's own baseline, and the affect reading.
 *
 * The `state`/`change` pair is the locked vocabulary: `state` is what was
 * measured, `change` is what it moved. Both share the same family shape
 * (intonation, stress, rhythm, tilt).
 */
export class VoiceFrame {
  /** Conversation-local lane this frame was attributed to. */
  readonly speakerId: string;
  /** Position of this frame's tip on the session audio clock, in ms. */
  readonly timestampMs: number;
  /** Start of the measured interval, in ms. */
  readonly startMs: number;
  /** End of the measured interval, in ms. */
  readonly endMs: number;
  /** How the voice sounded. Null when this frame carried no acoustic state. */
  readonly state: ProsodyState | null;
  /** What this frame moved against this speaker's own baseline. Null on the speaker's first frame. */
  readonly change: ProsodyChange | null;
  /** Measured valence/arousal/dominance. Null when the frame carried no affect block; each component is null on an unvoiced frame. */
  readonly vad: AffectVad | null;
  private readonly wireState: AcousticState | null;
  private readonly wireChange: AcousticChange | null;

  private constructor(args: {
    speakerId: string;
    timestampMs: number;
    startMs: number;
    endMs: number;
    state: AcousticState | null;
    change: AcousticChange | null;
    affect: AffectVad | null;
  }) {
    this.speakerId = args.speakerId;
    this.timestampMs = args.timestampMs;
    this.startMs = args.startMs;
    this.endMs = args.endMs;
    this.wireState = args.state;
    this.wireChange = args.change;
    this.state = prosodyStateFromWire(args.state);
    this.change = prosodyStateFromWire(args.state)
      ? prosodyDeltaFromWire(args.change)?.values ?? null
      : null;
    this.vad = args.affect;
  }

  /** Build a frame from a live `directive` event off `/v1/stream/realtime`. */
  static fromDirective(event: DirectiveEvent): VoiceFrame {
    return new VoiceFrame({
      speakerId: event.speaker_id,
      timestampMs: event.timestamp_ms,
      startMs: Math.max(0, event.timestamp_ms - 1000),
      endMs: event.timestamp_ms,
      state: event.acoustic_state ?? null,
      change: event.acoustic_change ?? null,
      affect: affectVadFrom(event.valence, event.arousal, event.dominance),
    });
  }

  /** Build a frame from one diarized batch window on `prosody_timeline`. */
  static fromTimelinePoint(point: ProsodyTimelinePoint): VoiceFrame {
    return new VoiceFrame({
      speakerId: point.speaker_id ?? 'unknown',
      timestampMs: point.end_ms,
      startMs: point.start_ms,
      endMs: point.end_ms,
      state: point.acoustic_state ?? null,
      change: point.acoustic_change ?? null,
      affect: affectVadFrom(point.valence, point.arousal, point.dominance),
    });
  }

  /** Build a frame from a live step without a full directive payload. */
  static fromLiveStep(args: {
    speakerId: string;
    timestampMs: number;
    acousticState: AcousticState | null;
    acousticChange?: AcousticChange | null;
  }): VoiceFrame {
    return new VoiceFrame({
      speakerId: args.speakerId,
      timestampMs: args.timestampMs,
      startMs: Math.max(0, args.timestampMs - 1000),
      endMs: args.timestampMs,
      state: args.acousticState,
      change: args.acousticChange ?? null,
      affect: null,
    });
  }

  /** Conversation-local lane this frame was attributed to. */
  getSpeakerId(): string {
    return this.speakerId;
  }

  /** Raw wire `acoustic_state` payload, for consumers that parse the wire themselves. */
  getAcousticState(): AcousticState | null {
    return this.wireState;
  }

  /** Raw wire `acoustic_change` payload, for consumers that parse the wire themselves. */
  getAcousticChange(): AcousticChange | null {
    return this.wireChange;
  }

  /** The measurement bundle for this frame: `state` plus `change`. */
  getProsody(): Prosody | null {
    return prosodyFromState(this.wireState, this.wireChange);
  }

  /** The committed movement with the baseline it was judged against. */
  getChange(): ProsodyDelta | null {
    return prosodyDeltaFromWire(this.wireChange);
  }
}

/**
 * Build an `AffectVad` from the wire's nullable dimensions. Returns `null`
 * when every dimension is null (an unvoiced frame with no affect reading);
 * the head is always trained, so a null dimension means unvoiced, never a
 * fabricated neutral.
 */
function affectVadFrom(
  valence: number | null,
  arousal: number | null,
  dominance: number | null,
): AffectVad | null {
  if (valence == null && arousal == null && dominance == null) return null;
  return { valence, arousal, dominance };
}
