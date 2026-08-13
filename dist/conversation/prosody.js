const MEASUREMENT_WIRE = {
    loudnessDbfs: 'rms_dbfs',
    peakDbfs: 'peak_dbfs',
    pitchHz: 'f0_median_hz',
    pitchRangeSemitones: 'f0_range_semitones',
    pitchSlopeSemitonesPerSecond: 'f0_slope_semitones_per_second',
    tiltDbPerOctave: 'spectral_tilt_db_per_octave',
    voicedRatio: 'voiced_ratio',
    pauseRatio: 'pause_ratio',
    clippingRatio: 'clipping_ratio',
    voiceOnsetRateHz: 'voice_onset_rate_hz',
};
const CHANGE_WIRE = {
    loudnessDb: 'rms_db_change',
    peakDb: 'peak_db_change',
    pitchSemitones: 'f0_median_semitone_change',
    pitchRangeSemitones: 'f0_range_semitone_change',
    pitchSlopeSemitonesPerSecond: 'f0_slope_semitones_per_second_change',
    tiltDbPerOctave: 'spectral_tilt_db_per_octave_change',
    voicedRatio: 'voiced_ratio_change',
    pauseRatio: 'pause_ratio_change',
    voiceOnsetRateHz: 'voice_onset_rate_hz_change',
};
function numberOf(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
/** Read one measurement from a wire acoustic state. */
export function measurementFromState(state, name) {
    return numberOf(state?.values?.[MEASUREMENT_WIRE[name]]);
}
/** Map wire change values onto the readable change shape. */
export function prosodyChangeFromWire(values) {
    if (!values)
        return null;
    const change = {};
    for (const [name, wire] of Object.entries(CHANGE_WIRE)) {
        change[name] = numberOf(values[wire]);
    }
    return change;
}
/** Map a wire acoustic change to a readable delta with its reference. */
export function prosodyDeltaFromWire(change) {
    const values = prosodyChangeFromWire(change?.values);
    if (!values)
        return null;
    return { reference: change?.reference ?? null, values };
}
/** Map a wire acoustic state onto the named, unit-carrying product shape. */
export function prosodyFromState(state, change) {
    if (!state)
        return null;
    const pitchAvailable = state.masks?.f0_available === true;
    return {
        loudnessDbfs: measurementFromState(state, 'loudnessDbfs'),
        peakDbfs: measurementFromState(state, 'peakDbfs'),
        pitchHz: pitchAvailable ? measurementFromState(state, 'pitchHz') : null,
        pitchRangeSemitones: pitchAvailable ? measurementFromState(state, 'pitchRangeSemitones') : null,
        pitchSlopeSemitonesPerSecond: pitchAvailable
            ? measurementFromState(state, 'pitchSlopeSemitonesPerSecond')
            : null,
        tiltDbPerOctave: measurementFromState(state, 'tiltDbPerOctave'),
        voicedRatio: measurementFromState(state, 'voicedRatio'),
        pauseRatio: measurementFromState(state, 'pauseRatio'),
        clippingRatio: measurementFromState(state, 'clippingRatio'),
        voiceOnsetRateHz: measurementFromState(state, 'voiceOnsetRateHz'),
        pitchAvailable,
        change: prosodyChangeFromWire(change?.values ?? null),
    };
}
export function prosodyFromWindow(window) {
    return prosodyFromState(window.getAcousticState(), window.getAcousticChange());
}
