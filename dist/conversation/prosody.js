/** Wire keys for the measured state, declared once in family shape. */
const STATE_WIRE = {
    intonation: {
        pitch: 'f0_median_hz',
        range: 'f0_range_semitones',
        slope: 'f0_slope_semitones_per_second',
    },
    stress: {
        loudness: 'rms_dbfs',
        peak: 'peak_dbfs',
    },
    rhythm: {
        voiced: 'voiced_ratio',
        pause: 'pause_ratio',
        onset: 'voice_onset_rate_hz',
    },
    tilt: 'spectral_tilt_db_per_octave',
    clipping: 'clipping_ratio',
};
/** Wire keys for speaker-relative movement, same family shape. */
const CHANGE_WIRE = {
    intonation: {
        pitch: 'f0_median_semitone_change',
        range: 'f0_range_semitone_change',
        slope: 'f0_slope_semitones_per_second_change',
    },
    stress: {
        loudness: 'rms_db_change',
        peak: 'peak_db_change',
    },
    rhythm: {
        voiced: 'voiced_ratio_change',
        pause: 'pause_ratio_change',
        onset: 'voice_onset_rate_hz_change',
    },
    tilt: 'spectral_tilt_db_per_octave_change',
};
function flattenWire(registry, prefix = '') {
    const out = {};
    for (const [key, node] of Object.entries(registry)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof node === 'string')
            out[path] = node;
        else
            Object.assign(out, flattenWire(node, path));
    }
    return out;
}
const STATE_WIRE_FLAT = flattenWire(STATE_WIRE);
function buildFromWire(registry, read) {
    if (typeof registry === 'string')
        return read(registry);
    const out = {};
    for (const [key, node] of Object.entries(registry)) {
        out[key] = buildFromWire(node, read);
    }
    return out;
}
function numberOf(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
/**
 * Map a wire acoustic state onto the measured frame. Intonation reads null
 * when the frame was unvoiced: F0 does not exist on unphonated audio.
 */
export function prosodyStateFromWire(state) {
    if (!state)
        return null;
    const built = buildFromWire(STATE_WIRE, (key) => numberOf(state.values?.[key]));
    if (state.masks?.f0_available !== true) {
        built.intonation = { pitch: null, range: null, slope: null };
    }
    return built;
}
/** Read one measurement from a wire acoustic state, by typed path. */
export function measurementFromState(state, path) {
    if (!state)
        return null;
    if (path.startsWith('intonation.') && state.masks?.f0_available !== true)
        return null;
    return numberOf(state.values?.[STATE_WIRE_FLAT[path]]);
}
/** Map wire change values onto the family-shaped movement. */
export function prosodyChangeFromWire(values) {
    if (!values)
        return null;
    return buildFromWire(CHANGE_WIRE, (key) => numberOf(values[key]));
}
/** Map a wire acoustic change to a delta with its reference. */
export function prosodyDeltaFromWire(change) {
    const values = prosodyChangeFromWire(change?.values);
    if (!values)
        return null;
    return { reference: change?.reference ?? null, values };
}
/** Map a wire acoustic state onto the product shape: state plus movement. */
export function prosodyFromState(state, change) {
    const built = prosodyStateFromWire(state);
    if (!built)
        return null;
    return { state: built, change: prosodyChangeFromWire(change?.values ?? null) };
}
export function prosodyFromFrame(frame) {
    return prosodyFromState(frame.getAcousticState(), frame.getAcousticChange());
}
