/**
 * One voice in this result.
 *
 * `id` is the identifier the API minted for this voice within this call.
 * Everything else in the response keys off it: turns, acoustic windows,
 * trajectories, deltas.
 *
 * Turns hold the same instance the result lists, so
 * `turn.speaker === transcription.speakers[0]` holds.
 */
export class Speaker {
    /** Speaker id, stable within this call. */
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
        const value = window.getMeasurement(name);
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
    const pitchHz = statOf(windows, 'pitchHz');
    return {
        loudnessDbfs: statOf(windows, 'loudnessDbfs'),
        pitchHz,
        pitchRangeSemitones: statOf(windows, 'pitchRangeSemitones'),
        tiltDbPerOctave: statOf(windows, 'tiltDbPerOctave'),
        voicedRatio: statOf(windows, 'voicedRatio'),
        pauseRatio: statOf(windows, 'pauseRatio'),
        windowCount: windows.length,
        pitchAvailable: pitchHz !== null,
    };
}
export function transcriptionFromConversation(conversation, options) {
    const includeProsody = options?.prosody !== false;
    const rawTurns = conversation.getTurns();
    // Labels number speakers by when they first talk in the recording.
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
            base.prosody = turn.prosody ?? null;
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
