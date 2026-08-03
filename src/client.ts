import type {
  AnalysisOptions,
  AnalysisResult,
  PCMOptions,
  FeedbackCorrectionOptions,
  SessionOutcomeOptions,
  RealtimeSessionCreateOptions,
  RealtimeSessionCredentials,
  SpeakerDirectoryResult,
  VoiceEnrollmentMapping,
  VoiceEnrollmentPreview,
  VoiceEnrollmentResult,
} from './types.js';
import type { ProsodyClientConfig } from './config.js';
import type { RequestOptions } from './http.js';
import { parseAnalysisResult } from './analysis.js';
import { Conversation } from './conversation.js';
import { resolveConfig } from './config.js';
import { postJSON, postForm, requestJSON } from './http.js';
import {
  ProsodyRealtimeStream,
  type ProsodyRealtimeHandlers,
  type RealtimeEncoding,
} from './realtime.js';
import { createWavBuffer } from './wav.js';
import { LiveSession, type LiveSessionOptions, type LiveSessionStartOptions } from './live-session.js';
import {
  ProsodySession,
  type LiveKitRoomLike,
  type ProsodySessionOptions,
} from './session.js';
import {
  transcriptionFromConversation,
  type Transcription,
  type TranscribeOptions,
} from './transcription.js';

type RealtimeSessionOpts = LiveSessionStartOptions & Pick<
  LiveSessionOptions,
  'onUpdate' | 'onError' | 'onClose' | 'onEvent' | 'WebSocketImpl'
>;

type RealtimeConnectOpts = {
  sessionId?: string;
  encoding?: RealtimeEncoding;
  sampleRate?: number;
  container?: 'ogg' | 'webm';
  analysisMode?: string;
  source?: string;
  sourceOffsetMs?: number;
  chunkSeconds?: number;
  WebSocketImpl?: typeof WebSocket;
};

/**
 * Developer client authenticated with a `psk_*` API key.
 *
 * Three transports — keep them straight:
 *
 * 1. **REST** — {@link ProsodyClient.transcribe} → `POST /v1/analyze/audio`
 * 2. **Realtime WebSocket** — {@link ProsodyClient.realtime} →
 *    `WS /v1/stream/realtime` (you send PCM/Opus; events come back)
 * 3. **LiveKit** — {@link ProsodyClient.livekit} → WebRTC media plane;
 *    mint a room, consume analysis events on the data topic. Audio does not
 *    go over the Prosody WebSocket from the browser.
 *
 * The Python LiveKit plugin bridges a LiveKit track → analysis WS on the
 * agent worker. That is an agent concern, not this client's job.
 */
export class ProsodyClient {
  private readonly opts: RequestOptions;
  readonly apiKey: string;
  readonly baseUrl: string;

  /**
   * Analysis WebSocket transport (`WS /v1/stream/realtime`).
   * Not LiveKit. Not WebRTC.
   */
  readonly realtime: {
    /** Session with Conversation: `start` → `send` → `stop`. */
    session: (options?: RealtimeSessionOpts) => LiveSession;
    /** Low-level stream if you want handlers without Conversation. */
    connect: (
      handlers?: ProsodyRealtimeHandlers,
      options?: RealtimeConnectOpts,
    ) => ProsodyRealtimeStream;
  };

  /**
   * LiveKit media plane (WebRTC). Audio rides LiveKit; Prosody events arrive
   * on the room data topic after a worker/plugin is analyzing the track.
   */
  readonly livekit: {
    /** Mint room credentials (`POST /v1/realtime/sessions`). Server-side only. */
    createSession: (
      options?: RealtimeSessionCreateOptions,
      signal?: AbortSignal,
    ) => Promise<RealtimeSessionCredentials>;
    /**
     * Attach to an existing LiveKit room and receive Prosody events from the
     * data channel. Does not open a Prosody WebSocket.
     */
    attach: (room: LiveKitRoomLike, options: ProsodySessionOptions) => ProsodySession;
  };

  readonly conversations: {
    analyze: (
      audio: string | Buffer,
      options?: AnalysisOptions,
      signal?: AbortSignal,
    ) => Promise<Conversation>;
  };
  readonly speakers: {
    list: (limit?: number, signal?: AbortSignal) => Promise<SpeakerDirectoryResult>;
    previewEnrollment: (
      audio: string | Buffer,
      signal?: AbortSignal,
    ) => Promise<VoiceEnrollmentPreview>;
    confirmEnrollment: (
      audio: string | Buffer,
      previewSha256: string,
      mappings: VoiceEnrollmentMapping[],
      signal?: AbortSignal,
    ) => Promise<VoiceEnrollmentResult>;
  };

  constructor(config: ProsodyClientConfig | string) {
    const resolved = resolveConfig(config);
    this.apiKey = resolved.apiKey;
    this.baseUrl = resolved.baseUrl;
    this.opts = resolved;
    this.conversations = Object.freeze({
      analyze: this.analyzeConversation.bind(this),
    });
    this.speakers = Object.freeze({
      list: this.listSpeakers.bind(this),
      previewEnrollment: this.previewSpeakerEnrollment.bind(this),
      confirmEnrollment: this.confirmSpeakerEnrollment.bind(this),
    });
    this.realtime = Object.freeze({
      session: (options?: RealtimeSessionOpts) => this.openRealtimeSession(options),
      connect: (
        handlers?: ProsodyRealtimeHandlers,
        options?: RealtimeConnectOpts,
      ) => this.openRealtimeStream(handlers, options),
    });
    this.livekit = Object.freeze({
      createSession: (
        options: RealtimeSessionCreateOptions = {},
        signal?: AbortSignal,
      ) => this.createRealtimeSession(options, signal),
      attach: (room: LiveKitRoomLike, options: ProsodySessionOptions) => {
        const session = new ProsodySession(room, options);
        session.start();
        return session;
      },
    });
  }

  // ──────────────────────── Transcription (REST) ────────────────────

  /**
   * Transcribe a recording over REST. Diarization and vocal measurement are
   * options (`prosody` defaults true).
   */
  async transcribe(
    audio: string | Buffer,
    options?: TranscribeOptions,
    signal?: AbortSignal,
  ): Promise<Transcription> {
    const conversation = await this.analyzeConversation(audio, options, signal);
    return transcriptionFromConversation(conversation, options);
  }

  // ──────────────────────────── Analysis ────────────────────────────

  async analyze(audio: string | Buffer, options?: AnalysisOptions, signal?: AbortSignal): Promise<AnalysisResult> {
    const formData = new FormData();

    if (typeof audio === 'string') {
      if (audio.startsWith('http')) {
        formData.append('audio_url', audio);
      } else {
        const fs = await import('fs');
        const buffer = fs.readFileSync(audio);
        formData.append('file', new Blob([new Uint8Array(buffer)]), 'audio.wav');
      }
    } else {
      formData.append('file', new Blob([new Uint8Array(audio)]), 'audio.wav');
    }

    if (options?.language) formData.append('language', options.language);
    if (options?.sessionId) formData.append('session_id', options.sessionId);
    const diarize = options?.diarize !== false;
    formData.append('diarize', diarize ? 'true' : 'false');

    const raw = await postForm<Record<string, unknown>>('/v1/analyze/audio', this.opts, formData, signal);
    return parseAnalysisResult(raw);
  }

  /** Analyze one recording into a diarized conversation with vocal measurements. */
  async analyzeConversation(
    audio: string | Buffer,
    options?: AnalysisOptions,
    signal?: AbortSignal,
  ): Promise<Conversation> {
    return Conversation.fromAnalysis(await this.analyze(audio, options, signal));
  }

  async analyzeBase64(base64Audio: string, options?: AnalysisOptions, signal?: AbortSignal): Promise<AnalysisResult> {
    const raw = await postJSON<Record<string, unknown>>('/v1/analyze/base64', this.opts, {
      audio_base64: base64Audio,
      language: options?.language,
      session_id: options?.sessionId,
      output_format: 'json',
    }, signal);
    return parseAnalysisResult(raw);
  }

  async analyzePCM(
    pcmData: Int16Array | Float32Array | ArrayBuffer,
    options?: PCMOptions,
    signal?: AbortSignal,
  ): Promise<AnalysisResult> {
    const sampleRate = options?.sampleRate || 16000;
    const channels = options?.channels || 1;
    const bitDepth = options?.bitDepth || 16;

    let samples: Int16Array;
    if (pcmData instanceof Float32Array) {
      samples = new Int16Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        samples[i] = Math.max(-32768, Math.min(32767, pcmData[i] * 32768));
      }
    } else if (pcmData instanceof ArrayBuffer) {
      samples = new Int16Array(pcmData);
    } else {
      samples = pcmData;
    }

    const wavBuffer = createWavBuffer(samples, sampleRate, channels, bitDepth);
    return this.analyze(Buffer.from(wavBuffer), options, signal);
  }

  // ───────────────────────── Speaker identity ──────────────────────

  /** People resolved from stored speaker profiles within this API key's data scope. */
  async listSpeakers(limit = 500, signal?: AbortSignal): Promise<SpeakerDirectoryResult> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new Error('listSpeakers limit must be an integer from 1 to 1000');
    }
    return requestJSON<SpeakerDirectoryResult>(
      'GET',
      `/v1/voice/speakers?limit=${limit}`,
      this.opts,
      null,
      undefined,
      signal,
    );
  }

  /** Diarize an enrollment recording without persisting any identity yet. */
  async previewSpeakerEnrollment(
    audio: string | Buffer,
    signal?: AbortSignal,
  ): Promise<VoiceEnrollmentPreview> {
    const formData = await enrollmentForm(audio);
    return postForm<VoiceEnrollmentPreview>(
      '/v1/voice/enrollments/preview',
      this.opts,
      formData,
      signal,
    );
  }

  /** Persist an operator-confirmed mapping from every previewed lane to a person. */
  async confirmSpeakerEnrollment(
    audio: string | Buffer,
    previewSha256: string,
    mappings: VoiceEnrollmentMapping[],
    signal?: AbortSignal,
  ): Promise<VoiceEnrollmentResult> {
    if (!previewSha256) throw new Error('confirmSpeakerEnrollment requires previewSha256');
    if (mappings.length === 0) throw new Error('confirmSpeakerEnrollment requires mappings');
    const formData = await enrollmentForm(audio);
    formData.append('preview_sha256', previewSha256);
    formData.append('mapping_json', JSON.stringify(mappings));
    return postForm<VoiceEnrollmentResult>(
      '/v1/voice/enrollments/confirm',
      this.opts,
      formData,
      signal,
    );
  }

  // ───────────────────────── Live analysis ─────────────────────────

  async extractFeatures(audio: string | Buffer, signal?: AbortSignal): Promise<Record<string, number>> {
    const formData = new FormData();
    if (typeof audio === 'string') {
      if (audio.startsWith('http')) {
        formData.append('audio_url', audio);
      } else {
        const fs = await import('fs');
        const buffer = fs.readFileSync(audio);
        formData.append('file', new Blob([new Uint8Array(buffer)]), 'audio.wav');
      }
    } else {
      formData.append('file', new Blob([new Uint8Array(audio)]), 'audio.wav');
    }
    return postForm<Record<string, number>>('/v1/features/prosody', this.opts, formData, signal);
  }

  async submitCorrection(options: FeedbackCorrectionOptions, signal?: AbortSignal): Promise<{ status: string }> {
    const hasCorrection = options.correctedValence !== undefined
      || options.correctedArousal !== undefined
      || options.correctedDominance !== undefined;
    if (!hasCorrection) {
      throw new Error('submitCorrection requires at least one corrected value');
    }
    assertFeedbackRange('correctedValence', options.correctedValence, -1, 1);
    assertFeedbackRange('correctedArousal', options.correctedArousal, 0, 1);
    assertFeedbackRange('correctedDominance', options.correctedDominance, 0, 1);
    return postJSON('/v1/feedback/correction', this.opts, {
      prediction_id: options.predictionId,
      corrected_valence: options.correctedValence,
      corrected_arousal: options.correctedArousal,
      corrected_dominance: options.correctedDominance,
      notes: options.notes,
    }, signal);
  }

  async submitSessionOutcome(options: SessionOutcomeOptions, signal?: AbortSignal): Promise<{ status: string }> {
    if (options.outcomes.length === 0) {
      throw new Error('submitSessionOutcome requires at least one KPI outcome');
    }
    return postJSON('/v1/feedback/session_outcome', this.opts, {
      session_id: options.sessionId,
      outcomes: options.outcomes,
      notes: options.notes,
    }, signal);
  }

  /**
   * @deprecated Use {@link ProsodyClient.realtime.connect}.
   * Low-level `WS /v1/stream/realtime` (analysis WebSocket — not LiveKit).
   */
  openRealtimeStream(
    handlers?: ProsodyRealtimeHandlers,
    options?: RealtimeConnectOpts,
  ): ProsodyRealtimeStream {
    return new ProsodyRealtimeStream(
      {
        apiKey: this.apiKey,
        baseUrl: this.baseUrl,
        sessionId: options?.sessionId,
        encoding: options?.encoding,
        sampleRate: options?.sampleRate,
        container: options?.container,
        analysisMode: options?.analysisMode,
        source: options?.source,
        sourceOffsetMs: options?.sourceOffsetMs,
        chunkSeconds: options?.chunkSeconds,
        WebSocketImpl: options?.WebSocketImpl,
      },
      handlers ?? {},
    );
  }

  /** @deprecated Use {@link ProsodyClient.realtime.session}. */
  openRealtimeSession(options?: RealtimeSessionOpts): LiveSession {
    const {
      onUpdate,
      onError,
      onClose,
      onEvent,
      WebSocketImpl,
      ...defaults
    } = options ?? {};
    return new LiveSession({
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
      defaults,
      WebSocketImpl,
      onUpdate,
      onError,
      onClose,
      onEvent,
    });
  }

  /**
   * Mint LiveKit room credentials. Prefer {@link ProsodyClient.livekit.createSession}.
   * Server-side only — holds `psk_*`.
   */
  async createRealtimeSession(
    options: RealtimeSessionCreateOptions = {},
    signal?: AbortSignal,
  ): Promise<RealtimeSessionCredentials> {
    return postJSON<RealtimeSessionCredentials>(
      '/v1/realtime/sessions',
      this.opts,
      { participant_name: options.participantName },
      signal,
    );
  }

  async health(signal?: AbortSignal): Promise<{ status: string }> {
    return requestJSON<{ status: string }>('GET', '/health', this.opts, null, undefined, signal);
  }
}

function assertFeedbackRange(
  field: string,
  value: number | undefined,
  minimum: number,
  maximum: number,
): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${field} must be a finite number from ${minimum} to ${maximum}`);
  }
}

async function enrollmentForm(audio: string | Buffer): Promise<FormData> {
  const formData = new FormData();
  if (typeof audio === 'string') {
    if (audio.startsWith('http')) {
      throw new Error('Speaker enrollment requires an uploaded file, not an audio URL');
    }
    const fs = await import('fs');
    const buffer = fs.readFileSync(audio);
    formData.append('file', new Blob([new Uint8Array(buffer)]), 'enrollment.wav');
  } else {
    formData.append('file', new Blob([new Uint8Array(audio)]), 'enrollment.wav');
  }
  return formData;
}
