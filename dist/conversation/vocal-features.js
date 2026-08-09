export function vocalFeaturesFromWindow(window) {
    return vocalFeaturesFromState(window.getAcousticState(), window.getAcousticChange());
}
export function vocalFeaturesFromState(state, change) {
    if (!state?.values)
        return null;
    const v = state.values;
    return {
        rms_dbfs: finiteOrNull(v.rms_dbfs),
        peak_dbfs: finiteOrNull(v.peak_dbfs),
        f0_median_hz: finiteOrNull(v.f0_median_hz),
        f0_range_semitones: finiteOrNull(v.f0_range_semitones),
        f0_slope_semitones_per_second: finiteOrNull(v.f0_slope_semitones_per_second),
        spectral_tilt_db_per_octave: finiteOrNull(v.spectral_tilt_db_per_octave),
        voiced_ratio: finiteOrNull(v.voiced_ratio),
        pause_ratio: finiteOrNull(v.pause_ratio),
        clipping_ratio: finiteOrNull(v.clipping_ratio),
        voice_onset_rate_hz: finiteOrNull(v.voice_onset_rate_hz),
        change: change?.values ?? null,
        f0_available: state.masks?.f0_available === true,
    };
}
function finiteOrNull(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
