import type { Conversation } from './conversation.js';
import { type Prosody } from './conversation/prosody.js';
import type { Moment } from './conversation/moments.js';
import type { VoiceFrame, AffectVad } from './step.js';
export type { Prosody, ProsodyChange } from './conversation/prosody.js';
export type { Moment } from './conversation/moments.js';
/**
 * Options for {@link ProsodyClient.transcribe}.
 */
export interface TranscribeOptions {
    language?: string;
    sessionId?: string;
    /** Label speakers within the recording. Defaults to true. */
    diarize?: boolean;
    /**
     * Attach vocal measurement to each turn (`turn.prosody`).
     * Defaults to true: that is the product.
     */
    prosody?: boolean;
}
/** Median and spread of one measured feature across a speaker's frames. */
export interface VoiceStat {
    /** Median reading across the frames that supported this measurement. */
    median: number;
    /** Lowest reading. */
    min: number;
    /** Highest reading. */
    max: number;
    /** Frames that carried a measurable value. */
    count: number;
}
/** Intonation baseline across a speaker's frames. */
export interface IntonationBaseline {
    /** Median F0. Null when no frame was voiced. */
    pitch: VoiceStat | null;
    /** Pitch span. */
    range: VoiceStat | null;
    /** Contour direction. */
    slope: VoiceStat | null;
}
/** Stress baseline across a speaker's frames. */
export interface StressBaseline {
    /** Loudness. */
    loudness: VoiceStat | null;
    /** Peak intensity. */
    peak: VoiceStat | null;
}
/** Rhythm baseline across a speaker's frames. */
export interface RhythmBaseline {
    /** Fraction phonated. */
    voiced: VoiceStat | null;
    /** Fraction silent. */
    pause: VoiceStat | null;
    /** Phonation onsets per second. */
    onset: VoiceStat | null;
}
/**
 * A speaker's measured voice: the baseline everything speaker-relative is
 * measured against.
 *
 * These are physical measurements of that voice across the recording. Fields
 * are `null` when no frame supported the measurement (for example pitch on
 * audio with no voiced frames). No embedding or voiceprint vector is exposed.
 */
export interface VoiceProfile {
    /** Intonation baseline. */
    intonation: IntonationBaseline;
    /** Stress baseline. */
    stress: StressBaseline;
    /** Rhythm baseline. */
    rhythm: RhythmBaseline;
    /** Voice quality baseline: spectral tilt. */
    tilt: VoiceStat | null;
    /** Frames measured for this speaker. */
    windowCount: number;
}
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
export declare class Speaker {
    /** Speaker id, stable within this call. */
    readonly id: string;
    /** Display label (`Speaker 1`), ordered by first appearance in this result. */
    readonly label: string;
    /** Total attributed speaking time, in ms. */
    readonly talkMs: number;
    /**
     * This speaker's share of all attributed speaking time on the call, 0 to 1.
     * Zero when nobody was attributed any speaking time.
     */
    readonly talkShare: number;
    /** Number of transcript turns attributed to this speaker. */
    readonly turnCount: number;
    /** This voice's measured baseline across the recording. */
    readonly state: VoiceProfile;
    constructor(init: {
        id: string;
        label: string;
        talkMs: number;
        talkShare: number;
        turnCount: number;
        state: VoiceProfile;
    });
    /** True when diarization could not attribute this audio. */
    get isUnknown(): boolean;
    /** Attributed speaking time, in seconds. */
    get talkSeconds(): number;
    /** Display label. */
    toString(): string;
    /** Plain object form, for logging or JSON transport. */
    toJSON(): {
        id: string;
        label: string;
        talkMs: number;
        talkShare: number;
        turnCount: number;
        state: VoiceProfile;
    };
}
/** One utterance: who said it, what they said, and how it sounded. */
export interface TranscribeTurn {
    /** The speaker who said this turn. */
    speaker: Speaker;
    /** The transcript text of the turn. */
    text: string;
    /** Start of the turn on the call clock, in ms. */
    startMs: number;
    /** End of the turn on the call clock, in ms. */
    endMs: number;
    /** How the voice sounded and moved on this turn. Present when `prosody` is on (the default). */
    prosody?: Prosody | null;
}
/**
 * Result of {@link ProsodyClient.transcribe}: the transcript, the speakers,
 * every measured frame, and the call-level affect.
 */
export interface Transcription {
    /** Full transcript text. */
    text: string;
    /** Diarized turns, in order. */
    turns: TranscribeTurn[];
    /** Speakers on this call, with their measured baselines. */
    speakers: Speaker[];
    /** Look up a speaker by id. */
    getSpeaker(id: string): Speaker | undefined;
    /** Turns belonging to one speaker. */
    turnsBySpeaker(speaker: Speaker | string): TranscribeTurn[];
    /** Every measured frame across the call, in order. */
    frames: VoiceFrame[];
    /**
     * Moments the model committed, ordered by how far the speaker's state
     * moved. This is the call's shortlist: the spans worth listening to.
     */
    moments: Moment[];
    /** Measured affect for the call, when the checkpoint publishes it. */
    vad: AffectVad | null;
    /** Lower-level object for trajectories and deltas. */
    conversation: Conversation;
}
export declare function transcriptionFromConversation(conversation: Conversation, options?: TranscribeOptions): Transcription;
