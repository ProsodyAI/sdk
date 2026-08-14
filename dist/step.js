import { prosodyDeltaFromWire, prosodyFromState, prosodyStateFromWire, } from './conversation/prosody.js';
/**
 * One measured interval of a call, as a consumer sees it.
 *
 * Built from a live `directive` event or a batch `prosody_timeline` window.
 * Raw Mimi latents and recurrent state tensors stay internal; this surface
 * carries only the readouts: who spoke, when, how the voice sounded, how it
 * moved against that speaker's own baseline, and the affect when published.
 *
 * The `state`/`change` pair is the locked vocabulary: `state` is what was
 * measured, `change` is what it moved. Both share the same family shape
 * (intonation, stress, rhythm, tilt).
 */
export class VoiceFrame {
    /** Conversation-local lane this frame was attributed to. */
    speakerId;
    /** Position of this frame's tip on the session audio clock, in ms. */
    timestampMs;
    /** Start of the measured interval, in ms. */
    startMs;
    /** End of the measured interval, in ms. */
    endMs;
    /** True when the checkpoint publishes affect readings for this frame. */
    affectAvailable;
    /** How the voice sounded. Null when this frame carried no acoustic state. */
    state;
    /** What this frame moved against this speaker's own baseline. Null on the speaker's first frame. */
    change;
    /** Measured valence/arousal/dominance, when `affectAvailable` is true. */
    vad;
    wireState;
    wireChange;
    constructor(args) {
        this.speakerId = args.speakerId;
        this.timestampMs = args.timestampMs;
        this.startMs = args.startMs;
        this.endMs = args.endMs;
        this.affectAvailable = args.affectAvailable;
        this.wireState = args.state;
        this.wireChange = args.change;
        this.state = prosodyStateFromWire(args.state);
        this.change = prosodyStateFromWire(args.state)
            ? prosodyDeltaFromWire(args.change)?.values ?? null
            : null;
        this.vad = args.affectAvailable ? args.affect : null;
    }
    /** Build a frame from a live `directive` event off `/v1/stream/realtime`. */
    static fromDirective(event) {
        const affectAvailable = event.affect_available === true;
        return new VoiceFrame({
            speakerId: event.speaker_id,
            timestampMs: event.timestamp_ms,
            startMs: Math.max(0, event.timestamp_ms - 1000),
            endMs: event.timestamp_ms,
            affectAvailable,
            state: event.acoustic_state ?? null,
            change: event.acoustic_change ?? null,
            affect: affectAvailable
                ? {
                    valence: event.valence,
                    arousal: event.arousal,
                    dominance: event.dominance,
                }
                : null,
        });
    }
    /** Build a frame from one diarized batch window on `prosody_timeline`. */
    static fromTimelinePoint(point, options) {
        const affectAvailable = options?.affectAvailable === true;
        return new VoiceFrame({
            speakerId: point.speaker_id ?? 'unknown',
            timestampMs: point.end_ms,
            startMs: point.start_ms,
            endMs: point.end_ms,
            affectAvailable,
            state: point.acoustic_state ?? null,
            change: point.acoustic_change ?? null,
            affect: affectAvailable
                ? {
                    valence: point.valence,
                    arousal: point.arousal,
                    dominance: point.dominance,
                }
                : null,
        });
    }
    /** Build a frame from a live step without a full directive payload. */
    static fromLiveStep(args) {
        return new VoiceFrame({
            speakerId: args.speakerId,
            timestampMs: args.timestampMs,
            startMs: Math.max(0, args.timestampMs - 1000),
            endMs: args.timestampMs,
            affectAvailable: args.affectAvailable === true,
            state: args.acousticState,
            change: args.acousticChange ?? null,
            affect: null,
        });
    }
    /** Conversation-local lane this frame was attributed to. */
    getSpeakerId() {
        return this.speakerId;
    }
    /** Raw wire `acoustic_state` payload, for consumers that parse the wire themselves. */
    getAcousticState() {
        return this.wireState;
    }
    /** Raw wire `acoustic_change` payload, for consumers that parse the wire themselves. */
    getAcousticChange() {
        return this.wireChange;
    }
    /** The measurement bundle for this frame: `state` plus `change`. */
    getProsody() {
        return prosodyFromState(this.wireState, this.wireChange);
    }
    /** The committed movement with the baseline it was judged against. */
    getChange() {
        return prosodyDeltaFromWire(this.wireChange);
    }
}
