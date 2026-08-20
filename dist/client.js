import { parseAnalysisResult } from './analysis.js';
import { Conversation } from './conversation.js';
import { resolveConfig } from './config.js';
import { callForm, callJSON, callQuery, endpoints } from './endpoints.js';
import { audioFormData } from './forms.js';
import { ProsodyRealtimeStream, } from './realtime.js';
import { createWavBuffer } from './wav.js';
import { LiveSession } from './live-session.js';
import { ProsodySession, } from './session.js';
import { transcriptionFromConversation, } from './transcription.js';
/**
 * Developer client authenticated with a `psk_*` API key.
 *
 * Three modes, named after the API's own prefixes:
 *
 * 1. **analyze**: REST batch, {@link ProsodyClient.transcribe} →
 *    `POST /v1/analyze/audio`
 * 2. **stream**: {@link ProsodyClient.stream} → `WS /v1/stream/realtime`
 *    (you send PCM/Opus; events come back)
 * 3. **realtime**: {@link ProsodyClient.realtime} → the LiveKit WebRTC
 *    media plane; mint a room, consume analysis events on the data topic.
 *    Audio does not go over the Prosody WebSocket from the browser.
 *
 * The Python LiveKit plugin bridges a LiveKit track → analysis WS on the
 * agent worker. That is an agent concern, and this client leaves it there.
 */
export class ProsodyClient {
    opts;
    apiKey;
    baseUrl;
    /**
     * The analysis WebSocket transport (`WS /v1/stream/realtime`).
     */
    stream;
    /**
     * The LiveKit media plane (WebRTC). Audio rides LiveKit; Prosody events
     * arrive on the room data topic after a worker/plugin is analyzing the
     * track.
     */
    realtime;
    /**
     * The batch analysis namespace. {@link ProsodyClient.conversations.analyze}
     * returns a `Conversation` (turns, speakers, frames, deltas).
     */
    conversations;
    /**
     * Speaker identity: list resolved people, and enroll new voices in a
     * two-step preview-then-confirm flow.
     */
    speakers;
    /**
     * Operator surface: a saved person's persisted significant moments.
     * Shipped for internal tooling and absent from the published docs.
     */
    memory;
    constructor(config) {
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
        this.memory = Object.freeze({
            recall: Object.freeze({ post: this.recallMemory.bind(this) }),
        });
        this.stream = Object.freeze({
            session: (options) => this.openRealtimeSession(options),
            connect: (handlers, options) => this.openRealtimeStream(handlers, options),
        });
        this.realtime = Object.freeze({
            createSession: (options = {}, signal) => this.createRealtimeSession(options, signal),
            attach: (room, options) => {
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
    async transcribe(audio, options, signal) {
        const conversation = await this.analyzeConversation(audio, options, signal);
        return transcriptionFromConversation(conversation, options);
    }
    // ──────────────────────────── Analysis ────────────────────────────
    /**
     * Raw batch analysis result (`POST /v1/analyze/audio`). Returns the parsed
     * `AnalysisResult` directly; prefer {@link ProsodyClient.transcribe} or
     * {@link ProsodyClient.analyzeConversation} for typed readouts.
     */
    async analyze(audio, options, signal) {
        const formData = await audioFormData(audio);
        if (options?.language)
            formData.append('language', options.language);
        if (options?.sessionId)
            formData.append('session_id', options.sessionId);
        const diarize = options?.diarize !== false;
        formData.append('diarize', diarize ? 'true' : 'false');
        const raw = await callForm(endpoints.analyzeAudio, this.opts, formData, signal);
        return parseAnalysisResult(raw);
    }
    /** Analyze one recording into a diarized conversation with vocal measurements. */
    async analyzeConversation(audio, options, signal) {
        return Conversation.fromAnalysis(await this.analyze(audio, options, signal));
    }
    // ────────────────── One-call readouts (batch analysis) ───────────
    /** Diarized turns with text: who said what, and when. */
    async getTurns(audio, options, signal) {
        return (await this.analyzeConversation(audio, options, signal)).getTurns();
    }
    /**
     * The timing skeleton of the conversation: one `{speaker_id, start_ms,
     * end_ms}` per turn on the model's 80ms frame clock. Carries no text.
     */
    async getTurnBoundaries(audio, options, signal) {
        const result = await this.analyze(audio, options, signal);
        const diarTurns = result.diarization?.turns;
        if (diarTurns?.length) {
            return diarTurns.map((turn) => ({
                speaker_id: turn.speaker,
                start_ms: turn.start_ms,
                end_ms: turn.end_ms,
            }));
        }
        return (result.turns ?? []).map((turn) => ({
            speaker_id: turn.speaker_id,
            start_ms: turn.start_ms,
            end_ms: turn.end_ms,
        }));
    }
    /**
     * The committed conversation events in commit order: turn boundaries,
     * barge-ins, and state deltas, each with its retrodictive `frame_ms` on the
     * 80ms frame clock.
     */
    async getEvents(audio, options, signal) {
        const result = await this.analyze(audio, options, signal);
        return [...(result.events ?? [])];
    }
    /** The recording-local speakers with talk time and turn counts. */
    async getSpeakers(audio, options, signal) {
        return (await this.analyzeConversation(audio, options, signal)).getSpeakers();
    }
    /** Analyze base64-encoded audio over the JSON endpoint. */
    async analyzeBase64(base64Audio, options, signal) {
        const raw = await callJSON(endpoints.analyzeBase64, this.opts, {
            audio_base64: base64Audio,
            language: options?.language,
            session_id: options?.sessionId,
            output_format: 'json',
        }, signal);
        return parseAnalysisResult(raw);
    }
    /** Analyze raw PCM (Int16/Float32/ArrayBuffer) by wrapping it as WAV first. */
    async analyzePCM(pcmData, options, signal) {
        const sampleRate = options?.sampleRate || 16000;
        const channels = options?.channels || 1;
        const bitDepth = options?.bitDepth || 16;
        let samples;
        if (pcmData instanceof Float32Array) {
            samples = new Int16Array(pcmData.length);
            for (let i = 0; i < pcmData.length; i++) {
                samples[i] = Math.max(-32768, Math.min(32767, pcmData[i] * 32768));
            }
        }
        else if (pcmData instanceof ArrayBuffer) {
            samples = new Int16Array(pcmData);
        }
        else {
            samples = pcmData;
        }
        const wavBuffer = createWavBuffer(samples, sampleRate, channels, bitDepth);
        return this.analyze(Buffer.from(wavBuffer), options, signal);
    }
    // ───────────────────────── Speaker identity ──────────────────────
    /** People resolved from stored speaker profiles within this API key's data scope. */
    async listSpeakers(limit = 500, signal) {
        if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
            throw new Error('listSpeakers limit must be an integer from 1 to 1000');
        }
        return callQuery(endpoints.listSpeakers, this.opts, { limit }, signal);
    }
    /** Diarize an enrollment recording without persisting any identity yet. */
    async previewSpeakerEnrollment(audio, signal) {
        const formData = await enrollmentForm(audio);
        return callForm(endpoints.previewEnrollment, this.opts, formData, signal);
    }
    /** Persist an operator-confirmed mapping from every previewed lane to a person. */
    async confirmSpeakerEnrollment(audio, previewSha256, mappings, signal) {
        if (!previewSha256)
            throw new Error('confirmSpeakerEnrollment requires previewSha256');
        if (mappings.length === 0)
            throw new Error('confirmSpeakerEnrollment requires mappings');
        const formData = await enrollmentForm(audio);
        formData.append('preview_sha256', previewSha256);
        formData.append('mapping_json', JSON.stringify(mappings));
        return callForm(endpoints.confirmEnrollment, this.opts, formData, signal);
    }
    // ───────────────────────────── Memory ────────────────────────────
    /**
     * A saved person's top-K significant moments, recency-ranked: the call
     * carries no ranking vector, so the route's recency mode answers.
     */
    async recallMemory(personId, topK = 5, signal) {
        if (!personId)
            throw new Error('memory.recall.post requires personId');
        if (!Number.isInteger(topK) || topK < 1 || topK > 50) {
            throw new Error('memory.recall.post topK must be an integer from 1 to 50');
        }
        return callJSON(endpoints.memoryRecall, this.opts, {
            person_id: personId,
            top_k: topK,
            include_recent: true,
        }, signal);
    }
    // ───────────────────────────── Feedback ──────────────────────────
    /** Submit corrected emotional attributes (valence, arousal, dominance) for a prediction, for model feedback. */
    async submitCorrection(options, signal) {
        const hasCorrection = options.correctedValence !== undefined
            || options.correctedArousal !== undefined
            || options.correctedDominance !== undefined;
        if (!hasCorrection) {
            throw new Error('submitCorrection requires at least one corrected value');
        }
        assertFeedbackRange('correctedValence', options.correctedValence, -1, 1);
        assertFeedbackRange('correctedArousal', options.correctedArousal, 0, 1);
        assertFeedbackRange('correctedDominance', options.correctedDominance, 0, 1);
        return callJSON(endpoints.submitCorrection, this.opts, {
            prediction_id: options.predictionId,
            corrected_valence: options.correctedValence,
            corrected_arousal: options.correctedArousal,
            corrected_dominance: options.correctedDominance,
            notes: options.notes,
        }, signal);
    }
    /** Submit per-session KPI outcomes for a call, for outcome labeling. */
    async submitSessionOutcome(options, signal) {
        if (options.outcomes.length === 0) {
            throw new Error('submitSessionOutcome requires at least one KPI outcome');
        }
        return callJSON(endpoints.submitSessionOutcome, this.opts, {
            session_id: options.sessionId,
            outcomes: options.outcomes,
            notes: options.notes,
        }, signal);
    }
    /** Service health check (`GET /v1/health`). */
    async health(signal) {
        return callQuery(endpoints.health, this.opts, undefined, signal);
    }
    // ─────────────────────── Realtime construction ───────────────────
    openRealtimeStream(handlers, options) {
        return new ProsodyRealtimeStream({
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
        }, handlers ?? {});
    }
    openRealtimeSession(options) {
        const { onUpdate, onError, onClose, onEvent, WebSocketImpl, ...defaults } = options ?? {};
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
     * Mint LiveKit room credentials for {@link ProsodyClient.realtime.createSession}.
     * Server-side only: it holds `psk_*`.
     */
    async createRealtimeSession(options = {}, signal) {
        return callJSON(endpoints.createRealtimeSession, this.opts, {
            participant_name: options.participantName,
            session_id: options.sessionId,
        }, signal);
    }
}
function assertFeedbackRange(field, value, minimum, maximum) {
    if (value === undefined)
        return;
    if (!Number.isFinite(value) || value < minimum || value > maximum) {
        throw new Error(`${field} must be a finite number from ${minimum} to ${maximum}`);
    }
}
async function enrollmentForm(audio) {
    if (typeof audio === 'string' && audio.startsWith('http')) {
        throw new Error('Speaker enrollment requires an uploaded audio file');
    }
    return audioFormData(audio, { filename: 'enrollment.wav', allowUrl: false });
}
