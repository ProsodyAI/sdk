import { type Prosody, type ProsodyChange, type ProsodyDelta, type ProsodyState } from './conversation/prosody.js';
import type { AcousticChange, AcousticState, DirectiveEvent, ProsodyTimelinePoint } from './types.js';
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
export declare class VoiceFrame {
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
    private readonly wireState;
    private readonly wireChange;
    private constructor();
    /** Build a frame from a live `directive` event off `/v1/stream/realtime`. */
    static fromDirective(event: DirectiveEvent): VoiceFrame;
    /** Build a frame from one diarized batch window on `prosody_timeline`. */
    static fromTimelinePoint(point: ProsodyTimelinePoint): VoiceFrame;
    /** Build a frame from a live step without a full directive payload. */
    static fromLiveStep(args: {
        speakerId: string;
        timestampMs: number;
        acousticState: AcousticState | null;
        acousticChange?: AcousticChange | null;
    }): VoiceFrame;
    /** Conversation-local lane this frame was attributed to. */
    getSpeakerId(): string;
    /** Raw wire `acoustic_state` payload, for consumers that parse the wire themselves. */
    getAcousticState(): AcousticState | null;
    /** Raw wire `acoustic_change` payload, for consumers that parse the wire themselves. */
    getAcousticChange(): AcousticChange | null;
    /** The measurement bundle for this frame: `state` plus `change`. */
    getProsody(): Prosody | null;
    /** The committed movement with the baseline it was judged against. */
    getChange(): ProsodyDelta | null;
}
