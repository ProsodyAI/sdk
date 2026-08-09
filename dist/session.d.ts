import type { DirectiveEvent, ProsodyEvent, ServerErrorEvent, SessionEndEvent, SpeakerProfilesEvent, SpeakerUpdateEvent, TranscriptUpdateEvent, WarningEvent } from './types.js';
import { AcousticWindow } from './step.js';
import type { Conversation } from './conversation.js';
/** Default LiveKit data topic matching API `livekit_event_topic`. */
export declare const PROSODY_EVENT_TOPIC = "prosody.events.v1";
export interface LiveKitParticipantLike {
    identity?: string;
}
export type LiveKitDataReceivedHandler = (payload: Uint8Array, participant?: LiveKitParticipantLike, kind?: unknown, topic?: string) => void;
/**
 * Structural subset of `livekit-client`'s Room. Keeping the dependency
 * peer-free lets applications use their existing LiveKit version.
 */
export interface LiveKitRoomLike {
    on(event: 'dataReceived', listener: LiveKitDataReceivedHandler): unknown;
    off(event: 'dataReceived', listener: LiveKitDataReceivedHandler): unknown;
}
export interface ProsodySessionOptions {
    sessionId: string;
    topic?: string;
    participantIdentity?: string;
    onDirective?: (event: DirectiveEvent) => void;
    /** Physical measurements and speaker-relative deltas for each directive. */
    onAcousticWindow?: (window: AcousticWindow) => void;
    /** Optional conversation object that receives parsed session events. */
    conversation?: Conversation;
    onTranscriptUpdate?: (event: TranscriptUpdateEvent) => void;
    onSpeakerUpdate?: (event: SpeakerUpdateEvent) => void;
    onSpeakerProfiles?: (event: SpeakerProfilesEvent) => void;
    onSessionEnd?: (event: SessionEndEvent) => void;
    onWarning?: (event: WarningEvent) => void;
    onServerError?: (event: ServerErrorEvent) => void;
    onEvent?: (event: ProsodyEvent) => void;
    onError?: (error: Error) => void;
}
type EventInput = string | Uint8Array | ArrayBuffer | Record<string, unknown>;
export declare function parseProsodyEvent(input: EventInput): ProsodyEvent;
export declare class ProsodySession {
    private readonly room;
    private readonly options;
    private readonly topic;
    private isStarted;
    private currentGeneration;
    private currentSeq;
    constructor(room: LiveKitRoomLike, options: ProsodySessionOptions);
    get generation(): number | null;
    get lastSeq(): number | null;
    start(): this;
    stop(): void;
    private readonly handleRoomData;
    private acceptSequence;
    private dispatch;
}
export {};
