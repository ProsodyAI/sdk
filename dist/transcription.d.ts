import type { Conversation, VocalFeatures } from './conversation.js';
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
     * Defaults to true — that is the product.
     */
    prosody?: boolean;
}
/** Median and spread of one measured feature across a speaker's audio. */
export interface VoiceStat {
    median: number;
    min: number;
    max: number;
    /** Windows that carried a measurable value. */
    count: number;
}
/**
 * A speaker's measured voice — the baseline everything speaker-relative is
 * measured against.
 *
 * These are physical measurements of that voice across the recording. Fields
 * are `null` when no window supported the measurement (for example pitch on
 * audio with no voiced frames). No embedding or voiceprint vector is exposed.
 */
export interface VoiceProfile {
    loudnessDbfs: VoiceStat | null;
    pitchHz: VoiceStat | null;
    pitchRangeSemitones: VoiceStat | null;
    tiltDbPerOctave: VoiceStat | null;
    voicedRatio: VoiceStat | null;
    pauseRatio: VoiceStat | null;
    /** Windows measured for this speaker. */
    windowCount: number;
    /** Whether pitch was measurable at all. */
    pitchAvailable: boolean;
}
/**
 * How this turn moved against the same speaker's preceding audio. Signed —
 * zero is a real reading, `null` means the feature was not measurable.
 */
export interface ProsodyChange {
    loudnessDb: number | null;
    peakDb: number | null;
    pitchSemitones: number | null;
    pitchRangeSemitones: number | null;
    pitchSlopeSemitonesPerSecond: number | null;
    tiltDbPerOctave: number | null;
    voicedRatio: number | null;
    pauseRatio: number | null;
    voiceOnsetRateHz: number | null;
}
/**
 * How a turn sounded, in physical units.
 *
 * A field is `null` when the audio did not support the measurement — pitch on
 * a whispered or unvoiced turn, for example.
 */
export interface Prosody {
    /** Loudness, dBFS. */
    loudnessDbfs: number | null;
    /** Loudest sample in the window, dBFS. */
    peakDbfs: number | null;
    /** Pitch, Hz. */
    pitchHz: number | null;
    /** Pitch movement within the turn, semitones. */
    pitchRangeSemitones: number | null;
    /** Pitch direction, semitones per second — negative falls, positive rises. */
    pitchSlopeSemitonesPerSecond: number | null;
    /** Spectral tilt, dB per octave. Breathy voices tilt steeper. */
    tiltDbPerOctave: number | null;
    /** Fraction of the turn carrying voiced audio, 0–1. */
    voicedRatio: number | null;
    /** Fraction of the turn that was silence, 0–1. */
    pauseRatio: number | null;
    /** Fraction of samples at the clipping ceiling, 0–1. */
    clippingRatio: number | null;
    /** Voice onsets per second — how often phonation restarts. */
    voiceOnsetRateHz: number | null;
    /** True when pitch was measurable on this turn. */
    pitchAvailable: boolean;
    /** Change against this speaker's own baseline. `null` on their first turn. */
    change: ProsodyChange | null;
}
/**
 * A voice in one recording or session.
 *
 * Turns hold the same instance the result lists, so
 * `turn.speaker === transcription.speakers[0]` holds. Scope is the recording —
 * a `Speaker` is not a person across calls.
 */
export declare class Speaker {
    /** Wire id (`speaker_0`), for correlating with raw API payloads. */
    readonly id: string;
    /** Display label (`Speaker 1`), or `Unknown speaker` when unattributed. */
    readonly label: string;
    readonly talkMs: number;
    readonly turnCount: number;
    /** This voice's measured baseline across the recording. */
    readonly voice: VoiceProfile;
    constructor(init: {
        id: string;
        label: string;
        talkMs: number;
        turnCount: number;
        voice: VoiceProfile;
    });
    /** True when diarization could not attribute this audio. */
    get isUnknown(): boolean;
    get talkSeconds(): number;
    toString(): string;
    toJSON(): {
        id: string;
        label: string;
        talkMs: number;
        turnCount: number;
        voice: VoiceProfile;
    };
}
/** One utterance: who said it, what they said, and how it sounded. */
export interface TranscribeTurn {
    speaker: Speaker;
    text: string;
    startMs: number;
    endMs: number;
    /** Present when `prosody` is on (the default). */
    prosody?: Prosody | null;
}
/**
 * Result of {@link ProsodyClient.transcribe}.
 *
 * `conversation` is the lower-level object for trajectories and deltas.
 */
export interface Transcription {
    text: string;
    turns: TranscribeTurn[];
    speakers: Speaker[];
    /** Look up a speaker by wire id. */
    getSpeaker(id: string): Speaker | undefined;
    /** Turns belonging to one speaker. */
    turnsBySpeaker(speaker: Speaker | string): TranscribeTurn[];
    conversation: Conversation;
}
/** Map the wire measurement onto the named, unit-carrying product shape. */
export declare function prosodyFromVocalFeatures(vocal: VocalFeatures | null | undefined): Prosody | null;
export declare function transcriptionFromConversation(conversation: Conversation, options?: TranscribeOptions): Transcription;
