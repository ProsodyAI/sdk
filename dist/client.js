import { parseAnalysisResult } from './analysis.js';
import { Conversation } from './conversation.js';
import { resolveConfig } from './config.js';
import { postJSON, postForm, requestJSON } from './http.js';
import { ProsodyRealtimeStream, } from './realtime.js';
import { createWavBuffer } from './wav.js';
import { LiveSession } from './live-session.js';
import { ProsodySession, } from './session.js';
import { transcriptionFromConversation, } from './transcription.js';
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
    opts;
    apiKey;
    baseUrl;
    /**
     * Analysis WebSocket transport (`WS /v1/stream/realtime`).
     * Not LiveKit. Not WebRTC.
     */
    realtime;
    /**
     * LiveKit media plane (WebRTC). Audio rides LiveKit; Prosody events arrive
     * on the room data topic after a worker/plugin is analyzing the track.
     */
    livekit;
    conversations;
    speakers;
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
        this.realtime = Object.freeze({
            session: (options) => this.openRealtimeSession(options),
            connect: (handlers, options) => this.openRealtimeStream(handlers, options),
        });
        this.livekit = Object.freeze({
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
    async analyze(audio, options, signal) {
        const formData = new FormData();
        if (typeof audio === 'string') {
            if (audio.startsWith('http')) {
                formData.append('audio_url', audio);
            }
            else {
                const fs = await import('fs');
                const buffer = fs.readFileSync(audio);
                formData.append('file', new Blob([new Uint8Array(buffer)]), 'audio.wav');
            }
        }
        else {
            formData.append('file', new Blob([new Uint8Array(audio)]), 'audio.wav');
        }
        if (options?.language)
            formData.append('language', options.language);
        if (options?.sessionId)
            formData.append('session_id', options.sessionId);
        const diarize = options?.diarize !== false;
        formData.append('diarize', diarize ? 'true' : 'false');
        const raw = await postForm('/v1/analyze/audio', this.opts, formData, signal);
        return parseAnalysisResult(raw);
    }
    /** Analyze one recording into a diarized conversation with vocal measurements. */
    async analyzeConversation(audio, options, signal) {
        return Conversation.fromAnalysis(await this.analyze(audio, options, signal));
    }
    async analyzeBase64(base64Audio, options, signal) {
        const raw = await postJSON('/v1/analyze/base64', this.opts, {
            audio_base64: base64Audio,
            language: options?.language,
            session_id: options?.sessionId,
            output_format: 'json',
        }, signal);
        return parseAnalysisResult(raw);
    }
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
        return requestJSON('GET', `/v1/voice/speakers?limit=${limit}`, this.opts, null, undefined, signal);
    }
    /** Diarize an enrollment recording without persisting any identity yet. */
    async previewSpeakerEnrollment(audio, signal) {
        const formData = await enrollmentForm(audio);
        return postForm('/v1/voice/enrollments/preview', this.opts, formData, signal);
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
        return postForm('/v1/voice/enrollments/confirm', this.opts, formData, signal);
    }
    // ───────────────────────── Live analysis ─────────────────────────
    async extractFeatures(audio, signal) {
        const formData = new FormData();
        if (typeof audio === 'string') {
            if (audio.startsWith('http')) {
                formData.append('audio_url', audio);
            }
            else {
                const fs = await import('fs');
                const buffer = fs.readFileSync(audio);
                formData.append('file', new Blob([new Uint8Array(buffer)]), 'audio.wav');
            }
        }
        else {
            formData.append('file', new Blob([new Uint8Array(audio)]), 'audio.wav');
        }
        return postForm('/v1/features/prosody', this.opts, formData, signal);
    }
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
        return postJSON('/v1/feedback/correction', this.opts, {
            prediction_id: options.predictionId,
            corrected_valence: options.correctedValence,
            corrected_arousal: options.correctedArousal,
            corrected_dominance: options.correctedDominance,
            notes: options.notes,
        }, signal);
    }
    async submitSessionOutcome(options, signal) {
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
    /** @deprecated Use {@link ProsodyClient.realtime.session}. */
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
     * Mint LiveKit room credentials. Prefer {@link ProsodyClient.livekit.createSession}.
     * Server-side only — holds `psk_*`.
     */
    async createRealtimeSession(options = {}, signal) {
        return postJSON('/v1/realtime/sessions', this.opts, { participant_name: options.participantName }, signal);
    }
    async health(signal) {
        return requestJSON('GET', '/health', this.opts, null, undefined, signal);
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
    const formData = new FormData();
    if (typeof audio === 'string') {
        if (audio.startsWith('http')) {
            throw new Error('Speaker enrollment requires an uploaded file, not an audio URL');
        }
        const fs = await import('fs');
        const buffer = fs.readFileSync(audio);
        formData.append('file', new Blob([new Uint8Array(buffer)]), 'enrollment.wav');
    }
    else {
        formData.append('file', new Blob([new Uint8Array(audio)]), 'enrollment.wav');
    }
    return formData;
}
