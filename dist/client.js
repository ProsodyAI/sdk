import { parseAnalysisResult } from './analysis.js';
import { Conversation } from './conversation.js';
import { resolveConfig } from './config.js';
import { postJSON, postForm, requestJSON } from './http.js';
import { ProsodyRealtimeStream, } from './realtime.js';
import { createWavBuffer } from './wav.js';
/**
 * Organization data-plane client (`psk_*`).
 *
 * Public verbs map to authenticated Prosody API routes. Request-scoped
 * conversation analysis and organization-scoped speaker identity are exposed
 * as separate namespaces.
 */
export class ProsodyClient {
    opts;
    apiKey;
    baseUrl;
    conversations;
    organization;
    constructor(config) {
        const resolved = resolveConfig(config);
        this.apiKey = resolved.apiKey;
        this.baseUrl = resolved.baseUrl;
        this.opts = resolved;
        this.conversations = Object.freeze({
            analyze: this.analyzeConversation.bind(this),
        });
        this.organization = Object.freeze({
            speakers: Object.freeze({
                list: this.listSpeakers.bind(this),
                previewEnrollment: this.previewSpeakerEnrollment.bind(this),
                confirmEnrollment: this.confirmSpeakerEnrollment.bind(this),
            }),
        });
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
    /** Analyze one recording into Bob’s Conversation (diarized turns + vocals). */
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
    /** People this organization has resolved from stored acoustic speaker profiles. */
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
        return postJSON('/v1/feedback/correction', this.opts, {
            prediction_id: options.predictionId,
            correct_emotion: options.correctEmotion,
            correct_valence: options.correctValence,
            correct_arousal: options.correctArousal,
            correct_dominance: options.correctDominance,
            notes: options.notes,
        }, signal);
    }
    async submitOutcome(options, signal) {
        return postJSON('/v1/feedback/outcome', this.opts, {
            prediction_id: options.predictionId,
            vertical: options.vertical,
            outcome_correct: options.outcomeCorrect,
            actual_csat: options.actualCsat,
            deal_won: options.dealWon,
            deal_value: options.dealValue,
            phq_score: options.phqScore,
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
     * Open `WS /v1/stream/realtime` with this org key.
     * Trusted server / worker only — do not put `psk_*` in the browser.
     */
    realtime(handlers, options) {
        return new ProsodyRealtimeStream({
            apiKey: this.apiKey,
            baseUrl: this.baseUrl,
            sessionId: options?.sessionId,
            encoding: options?.encoding,
            sampleRate: options?.sampleRate,
            container: options?.container,
            maxSpeakers: options?.maxSpeakers,
            analysisMode: options?.analysisMode,
            source: options?.source,
            WebSocketImpl: options?.WebSocketImpl,
        }, handlers ?? {});
    }
    /**
     * Mint one LiveKit room (media plane). Analysis still runs on the WebSocket
     * inside the Prosody worker. Call from a trusted server only.
     */
    async createRealtimeSession(options = {}, signal) {
        return postJSON('/v1/realtime/sessions', this.opts, { participant_name: options.participantName }, signal);
    }
    async health(signal) {
        return requestJSON('GET', '/health', this.opts, null, undefined, signal);
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
