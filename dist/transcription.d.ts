import type { Conversation } from './conversation.js';
import { type Prosody } from './conversation/prosody.js';
export type { Prosody, ProsodyChange } from './conversation/prosody.js';
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
/** Median and spread of one measured feature across a speaker's audio. */
export interface VoiceStat {
    median: number;
    min: number;
    max: number;
    /** Windows that carried a measurable value. */
    count: number;
}
/**
 * A speaker's measured voice: the baseline everything speaker-relative is
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
    /** Look up a speaker by id. */
    getSpeaker(id: string): Speaker | undefined;
    /** Turns belonging to one speaker. */
    turnsBySpeaker(speaker: Speaker | string): TranscribeTurn[];
    conversation: Conversation;
}
export declare function transcriptionFromConversation(conversation: Conversation, options?: TranscribeOptions): Transcription;
