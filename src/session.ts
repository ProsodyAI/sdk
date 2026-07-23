import type {
  AgentSteeringEvent,
  DirectiveEvent,
  InsightsUpdateEvent,
  ProsodyEvent,
  ProsodyEventType,
  ServerErrorEvent,
  SessionEndEvent,
  TranscriptUpdateEvent,
  WarningEvent,
} from './types.js';

export const PROSODY_EVENT_TOPIC = 'prosodyai.events';

const PROSODY_EVENT_TYPES: ReadonlySet<ProsodyEventType> = new Set([
  'directive',
  'transcript_update',
  'agent_steering',
  'insights_update',
  'session_end',
  'warning',
  'error',
]);

export interface LiveKitParticipantLike {
  identity?: string;
}

export type LiveKitDataReceivedHandler = (
  payload: Uint8Array,
  participant?: LiveKitParticipantLike,
  kind?: unknown,
  topic?: string,
) => void;

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
  onTranscriptUpdate?: (event: TranscriptUpdateEvent) => void;
  onSteering?: (event: AgentSteeringEvent) => void;
  onInsightsUpdate?: (event: InsightsUpdateEvent) => void;
  onSessionEnd?: (event: SessionEndEvent) => void;
  onWarning?: (event: WarningEvent) => void;
  onServerError?: (event: ServerErrorEvent) => void;
  onEvent?: (event: ProsodyEvent) => void;
  onError?: (error: Error) => void;
}

type EventInput = string | Uint8Array | ArrayBuffer | Record<string, unknown>;

export function parseProsodyEvent(input: EventInput): ProsodyEvent {
  const value = decodeEventInput(input);
  if (!isRecord(value)) {
    throw new Error('Prosody event must be a JSON object');
  }

  const sessionId = value.session_id;
  const generation = value.generation;
  const seq = value.seq;
  const type = value.type;

  if (typeof sessionId !== 'string' || !sessionId) {
    throw new Error('Prosody event missing session_id');
  }
  if (typeof generation !== 'number' || !Number.isInteger(generation) || generation < 0) {
    throw new Error('Prosody event generation must be a non-negative integer');
  }
  if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 0) {
    throw new Error('Prosody event seq must be a non-negative integer');
  }
  if (typeof type !== 'string' || !PROSODY_EVENT_TYPES.has(type as ProsodyEventType)) {
    throw new Error(`Unsupported Prosody event type: ${String(type)}`);
  }

  return value as unknown as ProsodyEvent;
}

export class ProsodySession {
  private readonly room: LiveKitRoomLike;
  private readonly options: ProsodySessionOptions;
  private readonly topic: string;
  private isStarted = false;
  private currentGeneration: number | null = null;
  private currentSeq = -1;

  constructor(room: LiveKitRoomLike, options: ProsodySessionOptions) {
    if (!options.sessionId) {
      throw new Error('ProsodySession requires a sessionId');
    }
    this.room = room;
    this.options = options;
    this.topic = options.topic ?? PROSODY_EVENT_TOPIC;
  }

  get generation(): number | null {
    return this.currentGeneration;
  }

  get lastSeq(): number | null {
    return this.currentSeq >= 0 ? this.currentSeq : null;
  }

  start(): this {
    if (this.isStarted) return this;
    this.room.on('dataReceived', this.handleRoomData);
    this.isStarted = true;
    return this;
  }

  stop(): void {
    if (!this.isStarted) return;
    this.room.off('dataReceived', this.handleRoomData);
    this.isStarted = false;
  }

  private readonly handleRoomData: LiveKitDataReceivedHandler = (
    payload,
    participant,
    _kind,
    topic,
  ) => {
    if (topic !== this.topic) return;
    if (
      this.options.participantIdentity
      && participant?.identity !== this.options.participantIdentity
    ) {
      return;
    }

    try {
      const event = parseProsodyEvent(payload);
      if (event.session_id !== this.options.sessionId || !this.acceptSequence(event)) {
        return;
      }
      this.dispatch(event);
    } catch (error) {
      this.options.onError?.(toError(error));
    }
  };

  private acceptSequence(event: ProsodyEvent): boolean {
    if (
      this.currentGeneration !== null
      && event.generation < this.currentGeneration
    ) {
      return false;
    }

    if (this.currentGeneration === null || event.generation > this.currentGeneration) {
      this.currentGeneration = event.generation;
      this.currentSeq = -1;
    }

    if (event.seq <= this.currentSeq) return false;
    this.currentSeq = event.seq;
    return true;
  }

  private dispatch(event: ProsodyEvent): void {
    switch (event.type) {
      case 'directive':
        this.options.onDirective?.(event);
        break;
      case 'transcript_update':
        this.options.onTranscriptUpdate?.(event);
        break;
      case 'agent_steering':
        this.options.onSteering?.(event);
        break;
      case 'insights_update':
        this.options.onInsightsUpdate?.(event);
        break;
      case 'session_end':
        this.options.onSessionEnd?.(event);
        break;
      case 'warning':
        this.options.onWarning?.(event);
        break;
      case 'error':
        this.options.onServerError?.(event);
        break;
    }
    this.options.onEvent?.(event);
  }
}

function decodeEventInput(input: EventInput): unknown {
  if (typeof input === 'string') return JSON.parse(input);
  if (input instanceof Uint8Array) {
    return JSON.parse(new TextDecoder().decode(input));
  }
  if (input instanceof ArrayBuffer) {
    return JSON.parse(new TextDecoder().decode(new Uint8Array(input)));
  }
  return input;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
