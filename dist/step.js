/**
 * One gated ProsodySSM recurrent step, as a consumer sees it.
 *
 * Backed by live `directive` or a batch `prosody_timeline` window — not by
 * inventing fields. Raw Mimi latents and recurrent state tensors stay off this
 * object.
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
    /** Full gated `acoustic_state` object (values / masks / frames). */
    getAcousticState() {
        return this.state;
    }
    getAcousticChange() {
        return this.change;
    }
    getValues() {
        return this.state?.values ?? null;
    }
    getFrames() {
        return this.state?.frames ?? null;
    }
    getFeature(name) {
        return finiteOrNull(this.state?.values?.[name]);
    }
    getDelta(name) {
        return finiteOrNull(this.change?.values?.[name]);
    }
    /** Mimi-aligned frame trajectory for live windows. Batch reports omit frames. */
    getFrameSeries(name) {
        const frames = this.state?.frames;
        const values = frames?.[name];
        if (!Array.isArray(values))
            return [];
        const frameRateHz = finiteOrNull(frames?.frame_rate_hz) ?? 12.5;
        return values.map((value, index) => ({
            timeMs: this.startMs + (index * 1000) / frameRateHz,
            value: finiteOrNull(value),
        }));
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
        const frames = this.state?.frames?.voiced_probability;
        return {
            voicedRatio: finiteOrNull(values?.voiced_ratio),
            pauseRatio: finiteOrNull(values?.pause_ratio),
            onsetRateHz: finiteOrNull(values?.voice_onset_rate_hz),
            frameVoicedProbability: Array.isArray(frames) ? [...frames] : null,
        };
    }
    getTilt() {
        if (this.state?.masks?.spectral_tilt_available === false)
            return null;
        return finiteOrNull(this.state?.values?.spectral_tilt_db_per_octave);
    }
    /**
     * Affect VAD only when the checkpoint says it is a measurement.
     * Never treat defaults as product when `affectAvailable` is false.
     */
    getVad() {
        return this.affectAvailable ? this.affect : null;
    }
    /** Speaker-relative deltas vs prior chunk in this speaker's recurrent scope. */
    getChange() {
        return this.change?.values ?? null;
    }
    /** Bob-facing bundle of gated vocal measurements for this step. */
    getVocalFeatures() {
        const values = this.state?.values;
        if (!values)
            return null;
        return {
            rms_dbfs: finiteOrNull(values.rms_dbfs),
            peak_dbfs: finiteOrNull(values.peak_dbfs),
            f0_median_hz: finiteOrNull(values.f0_median_hz),
            f0_range_semitones: finiteOrNull(values.f0_range_semitones),
            f0_slope_semitones_per_second: finiteOrNull(values.f0_slope_semitones_per_second),
            spectral_tilt_db_per_octave: finiteOrNull(values.spectral_tilt_db_per_octave),
            voiced_ratio: finiteOrNull(values.voiced_ratio),
            pause_ratio: finiteOrNull(values.pause_ratio),
            clipping_ratio: finiteOrNull(values.clipping_ratio),
            voice_onset_rate_hz: finiteOrNull(values.voice_onset_rate_hz),
            change: this.change?.values ?? null,
            f0_available: this.state?.masks?.f0_available === true,
        };
    }
}
/** @deprecated Use AcousticWindow. */
export { AcousticWindow as RecurrentStep };
function finiteOrNull(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
