import { parseAnalysisResult } from './analysis.js';
import { resolveConfig } from './config.js';
import { postJSON, postForm, requestJSON } from './http.js';
import { createWavBuffer } from './wav.js';
export class ProsodyClient {
    opts;
    apiKey;
    baseUrl;
    constructor(config) {
        const resolved = resolveConfig(config);
        this.apiKey = resolved.apiKey;
        this.baseUrl = resolved.baseUrl;
        this.opts = resolved;
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
        // Interview product: per-turn VAD + signals. Opt out with { diarize: false }.
        const diarize = options?.diarize !== false;
        formData.append('diarize', diarize ? 'true' : 'false');
        const raw = await postForm('/v1/analyze/audio', this.opts, formData, signal);
        return parseAnalysisResult(raw);
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
    // ──────────────────────────── Features ────────────────────────────
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
    // ──────────────────────────── Health ──────────────────────────────
    async health(signal) {
        return requestJSON('GET', '/health', this.opts, null, undefined, signal);
    }
    // ──────────────────────────── Feedback ────────────────────────────
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
}
