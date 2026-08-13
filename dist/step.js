import { measurementFromState, prosodyDeltaFromWire, prosodyFromState, } from './conversation/prosody.js';
/**
 * One gated ProsodySSM recurrent step, as a consumer sees it.
 *
 * Built from a live `directive` or batch `prosody_timeline` window. Raw Mimi
 * latents and recurrent state tensors remain internal.
 */
export class AcousticWindow {
    speakerId;
    timestampMs;
    startMs;
    endMs;
    affectAvailable;
    state;
    change;
    affect;
    constructor(args) {
        this.speakerId = args.speakerId;
        this.timestampMs = args.timestampMs;
        this.startMs = args.startMs;
        this.endMs = args.endMs;
        this.affectAvailable = args.affectAvailable;
        this.state = args.state;
        this.change = args.change;
        this.affect = args.affect;
    }
    /** Live analysis chunk (`directive` from `/v1/stream/realtime`). */
    static fromDirective(event) {
        const affectAvailable = event.affect_available === true;
        return new AcousticWindow({
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
    /** One diarized batch window from `prosody_timeline`. */
    static fromTimelinePoint(point, options) {
        const affectAvailable = options?.affectAvailable === true;
        return new AcousticWindow({
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
    /** Live step without requiring a full directive payload. */
    static fromLiveStep(args) {
        return new AcousticWindow({
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
    getSpeakerId() {
        return this.speakerId;
    }
    /** Wire `acoustic_state` payload, for consumers that parse the wire themselves. */
    getAcousticState() {
        return this.state;
    }
    /** Wire `acoustic_change` payload, for consumers that parse the wire themselves. */
    getAcousticChange() {
        return this.change;
    }
    /** The full measurement bundle for this window, under readable names. */
    getProsody() {
        return prosodyFromState(this.state, this.change);
    }
    /** One measurement from this window, by readable name. */
    getMeasurement(name) {
        return measurementFromState(this.state, name);
    }
    getPitch() {
        const values = this.state?.values;
        const masks = this.state?.masks;
        return {
            medianHz: finiteOrNull(values?.f0_median_hz),
            rangeSemitones: finiteOrNull(values?.f0_range_semitones),
            slopeSemitonesPerSecond: finiteOrNull(values?.f0_slope_semitones_per_second),
            available: masks?.f0_available === true,
        };
    }
    /** Convenience: median F0 Hz, or null. */
    getPitchHz() {
        const pitch = this.getPitch();
        return pitch.available ? pitch.medianHz : null;
    }
    getLevel() {
        const values = this.state?.values;
        return {
            rmsDbfs: finiteOrNull(values?.rms_dbfs),
            peakDbfs: finiteOrNull(values?.peak_dbfs),
            clippingRatio: finiteOrNull(values?.clipping_ratio),
        };
    }
    getVoicing() {
        const values = this.state?.values;
        const mask = this.state?.masks?.voiced_mask;
        return {
            voicedRatio: finiteOrNull(values?.voiced_ratio),
            pauseRatio: finiteOrNull(values?.pause_ratio),
            onsetRateHz: finiteOrNull(values?.voice_onset_rate_hz),
            frameVoiced: Array.isArray(mask) ? [...mask] : null,
        };
    }
    getTilt() {
        if (this.state?.masks?.spectral_tilt_available === false)
            return null;
        return finiteOrNull(this.state?.values?.spectral_tilt_db_per_octave);
    }
    /**
     * Return V/A/D when the checkpoint marks affect as a trained measurement.
     */
    getVad() {
        return this.affectAvailable ? this.affect : null;
    }
    /** Speaker-relative movement vs the prior window in this speaker's scope. */
    getChange() {
        return prosodyDeltaFromWire(this.change);
    }
}
function finiteOrNull(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
