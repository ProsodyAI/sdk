/**
 * Validate the stable batch envelope.
 *
 * ProsodySSM's product output is `acoustic_state` — measured waveform values
 * per window — which arrives on `prosody_timeline` and on each turn. Valence /
 * arousal / dominance are only readings when `affect_available` is true, so
 * they are never required here: a deployment that publishes measurements and
 * no affect is a correct deployment, not a malformed response.
 */
export function parseAnalysisResult(value) {
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
    if (value.affect_available === true) {
        for (const field of ['valence', 'arousal', 'dominance']) {
            if (typeof value.prosody[field] !== 'number') {
                throw new Error(`Analysis result declares affect_available but prosody.${field} is not a number`);
            }
        }
    }
    return value;
}
/**
 * The measured windows of a call, in order.
 *
 * Empty when the upload was not diarized (`diarize: false`), since the timeline
 * is only built for a diarized call.
 */
export function acousticWindows(result) {
    return (result.prosody_timeline ?? []).filter((point) => point.acoustic_state != null);
}
/**
 * Read one measured feature across a call, skipping windows where it was not
 * measurable (unvoiced windows carry `null` f0 rather than a floor value).
 */
export function acousticSeries(result, feature) {
    const series = [];
    for (const point of acousticWindows(result)) {
        const value = point.acoustic_state?.values?.[feature];
        if (typeof value === 'number' && Number.isFinite(value)) {
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
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
