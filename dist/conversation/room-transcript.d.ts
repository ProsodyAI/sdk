import { type LiveSegment } from './turn-model.js';
/** The agent is the other party on the call; its words carry this fixed label. */
export declare const AGENT_SPEAKER_ID = "agent";
/** Caller words the deployment attributed to no speaker carry this label. */
export declare const UNKNOWN_SPEAKER_ID = "unknown";
export declare const ROOM_TRANSCRIPT_EVENT = "prosodyai.transcript";
export declare const ROOM_SPEAKER_CHANGE_EVENT = "prosodyai.speaker_change";
/**
 * One span of a speaker's words on the session audio clock. A final delta is
 * whole words and never changes. An interim delta (`final` false) is the word
 * still being spoken; it replaces the stream's previous interim, and the
 * stream's next final supersedes it.
 */
export type RoomTranscriptDelta = {
    text: string;
    start_ms: number;
    end_ms: number;
    final: boolean;
};
export type RoomTranscriptEvent = {
    type: typeof ROOM_TRANSCRIPT_EVENT;
    speaker_id: string;
    deltas: RoomTranscriptDelta[];
};
/** Sortformer moved the caller surface; `timestamp_ms` is the new voice's onset. */
export type RoomSpeakerChangeEvent = {
    type: typeof ROOM_SPEAKER_CHANGE_EVENT;
    timestamp_ms: number;
    speaker_id: string;
    is_agent: boolean;
};
export type RoomTranscriptInput = RoomTranscriptEvent | RoomSpeakerChangeEvent;
/**
 * Decode one room data-topic payload into the events this model reads, or
 * null for any other event type or a malformed one.
 */
export declare function parseRoomTranscriptInput(payload: unknown): RoomTranscriptInput | null;
/**
 * The transcript a room's data topic builds, as a reader sees it.
 *
 * Words: an interim opens a result and later interims keep it; the next final
 * takes the same id, so the whole word replaces the forming one, whichever
 * speaker either arrived under. A final with nothing forming is appended.
 *
 * Speakers: a `speaker_change` is an onset. The voice on the floor owns the
 * unattributed words from its onset until the next different onset; the first
 * onset also owns the unattributed words before it, since no other voice was
 * on the floor. A word the model already attributed keeps its speaker. The
 * agent's words arrive on their fixed lane and are never relabeled.
 */
export declare class RoomTranscript {
    private segments;
    private spans;
    private floor;
    private agentSpeakerIds;
    private openWordResult;
    private wordResults;
    /** Feed one decoded room payload; events this model does not read are ignored. */
    observe(payload: unknown): void;
    /** Every held segment, agent lines included, in session-clock order. */
    all(): LiveSegment[];
    /** The callers' whole words, in session-clock order. */
    words(): LiveSegment[];
    /** The callers' words still forming: an interim no final has superseded. */
    forming(): LiveSegment[];
    /** The callers' whole words no speaker owns. */
    unattributedWords(): LiveSegment[];
    /** The distinct caller speakers that own whole words. */
    speakers(): string[];
    /** The callers' transcript as text. */
    text(): string;
    /** The agent's line as text. */
    agentText(): string;
    private isAgent;
    private transcript;
    /** The voice on the floor at `startMs`, for a word the model left unattributed. */
    private floorSpeakerFor;
    private speakerChange;
    private commitSpan;
}
