/**
 * One voice.
 *
 * `id` is the identifier the API minted for this voice — a UUID that is stable
 * for the same voice across recordings and sessions in your organization.
 * Everything else in the response keys off it: turns, acoustic windows,
 * trajectories, deltas.
 *
 * Turns hold the same instance the result lists, so
 * `turn.speaker === transcription.speakers[0]` holds.
 */
export class Speaker {
    /** Speaker UUID. Stable for this voice across sessions. */
    id;
    /** Display label (`Speaker 1`), ordered by first appearance in this result. */
    label;
    talkMs;
    turnCount;
    /** This voice's measured baseline across the recording. */
    voice;
    constructor(init) {
        this.id = init.id;
        this.label = init.label;
        this.talkMs = init.talkMs;
        this.turnCount = init.turnCount;
        this.voice = init.voice;
    }
    /** True when diarization could not attribute this audio. */
    get isUnknown() {
        return this.id === 'unknown';
    }
    get talkSeconds() {
        return this.talkMs / 1000;
    }
    toString() {
        return this.label;
    }
    toJSON() {
        return {
            id: this.id,
            label: this.label,
            talkMs: this.talkMs,
            turnCount: this.turnCount,
            voice: this.voice,
        };
    }
}
function speakerLabel(id, index) {
    if (id === 'unknown')
        return 'Unknown speaker';
    return index >= 0 ? `Speaker ${index + 1}` : id;
}
function statOf(windows, name) {
    const values = [];
    for (const window of windows) {
        const value = window.getFeature(name);
        if (value !== null)
            values.push(value);
    }
    if (!values.length)
        return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    const median = sorted.length % 2
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2;
    return {
        median,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        count: sorted.length,
    };
}
function voiceProfileOf(windows) {
    const pitchHz = statOf(windows, 'f0_median_hz');
    return {
        loudnessDbfs: statOf(windows, 'rms_dbfs'),
        pitchHz,
        pitchRangeSemitones: statOf(windows, 'f0_range_semitones'),
        tiltDbPerOctave: statOf(windows, 'spectral_tilt_db_per_octave'),
        voicedRatio: statOf(windows, 'voiced_ratio'),
        pauseRatio: statOf(windows, 'pause_ratio'),
        windowCount: windows.length,
        pitchAvailable: pitchHz !== null,
    };
}
function prosodyChangeOf(change) {
    if (!change)
        return null;
    const at = (name) => {
        const value = change[name];
        return typeof value === 'number' ? value : null;
    };
    return {
        loudnessDb: at('rms_db_change'),
        peakDb: at('peak_db_change'),
        pitchSemitones: at('f0_median_semitone_change'),
        pitchRangeSemitones: at('f0_range_semitone_change'),
        pitchSlopeSemitonesPerSecond: at('f0_slope_semitones_per_second_change'),
        tiltDbPerOctave: at('spectral_tilt_db_per_octave_change'),
        voicedRatio: at('voiced_ratio_change'),
        pauseRatio: at('pause_ratio_change'),
        voiceOnsetRateHz: at('voice_onset_rate_hz_change'),
    };
}
/** Map the wire measurement onto the named, unit-carrying product shape. */
export function prosodyFromVocalFeatures(vocal) {
    if (!vocal)
        return null;
    return {
        loudnessDbfs: vocal.rms_dbfs,
        peakDbfs: vocal.peak_dbfs,
        pitchHz: vocal.f0_median_hz,
        pitchRangeSemitones: vocal.f0_range_semitones,
        pitchSlopeSemitonesPerSecond: vocal.f0_slope_semitones_per_second,
        tiltDbPerOctave: vocal.spectral_tilt_db_per_octave,
        voicedRatio: vocal.voiced_ratio,
        pauseRatio: vocal.pause_ratio,
        clippingRatio: vocal.clipping_ratio,
        voiceOnsetRateHz: vocal.voice_onset_rate_hz,
        pitchAvailable: vocal.f0_available,
        change: prosodyChangeOf(vocal.change),
    };
}
export function transcriptionFromConversation(conversation, options) {
    const includeProsody = options?.prosody !== false;
    const rawTurns = conversation.getTurns();
    // Labels number speakers by when they first talk, not by the order the
    // roll-up happens to list them in.
    const firstHeard = new Map();
    for (const turn of rawTurns) {
        if (!firstHeard.has(turn.speaker_id))
            firstHeard.set(turn.speaker_id, turn.start_ms);
    }
    const ordered = [...conversation.getSpeakers()].sort((a, b) => ((firstHeard.get(a.speaker_id) ?? Number.MAX_SAFE_INTEGER)
        - (firstHeard.get(b.speaker_id) ?? Number.MAX_SAFE_INTEGER)));
    const speakers = ordered.map((entry, index) => new Speaker({
        id: entry.speaker_id,
        label: speakerLabel(entry.speaker_id, index),
        talkMs: entry.talk_ms,
        turnCount: entry.turn_count,
        voice: voiceProfileOf(conversation.getAcoustics(entry.speaker_id)),
    }));
    const byId = new Map(speakers.map((speaker) => [speaker.id, speaker]));
    const speakerFor = (id) => {
        const existing = byId.get(id);
        if (existing)
            return existing;
        // A turn can carry a label the speaker roll-up dropped (e.g. `unknown`).
        const created = new Speaker({
            id,
            label: speakerLabel(id, -1),
            talkMs: 0,
            turnCount: 0,
            voice: voiceProfileOf(conversation.getAcoustics(id)),
        });
        byId.set(id, created);
        return created;
    };
    const turns = rawTurns.map((turn) => {
        const base = {
            speaker: speakerFor(turn.speaker_id),
            text: turn.text,
            startMs: turn.start_ms,
            endMs: turn.end_ms,
        };
        if (includeProsody)
            base.prosody = prosodyFromVocalFeatures(turn.vocal);
        return base;
    });
    return {
        text: conversation.getTranscript(),
        turns,
        speakers,
        getSpeaker: (id) => byId.get(id),
        turnsBySpeaker: (speaker) => {
            const id = typeof speaker === 'string' ? speaker : speaker.id;
            return turns.filter((turn) => turn.speaker.id === id);
        },
        conversation,
    };
}
