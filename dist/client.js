import { resolveConfig } from '@/config';
import { createWavBuffer } from '@/wav';
import { postJSON, postForm, requestJSON } from '@/http';
import { ProsodyStream } from '@/stream';
import { ProsodyRealtimeStream } from '@/realtime';
function modelResponseToAnalysisResult(raw) {
    if (raw.error) {
        throw new Error(raw.error);
    }
    return {
        prediction_id: '',
        text: '',
        emotion: {
            primary: raw.emotion ?? 'neutral',
            confidence: raw.confidence ?? 0,
            probabilities: raw.emotion_probabilities ?? {},
        },
        valence: raw.valence ?? 0,
        arousal: raw.arousal ?? 0.5,
        dominance: raw.dominance ?? 0.5,
        duration: 0,
        word_count: 0,
        format: 'json',
    };
}
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
    /** Call model predict URL with Api-Key and { audio_base64 }; map response to AnalysisResult. */
    async analyzeViaModelPredict(audioBase64, signal) {
        const url = this.opts.modelPredictUrl;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.opts.timeoutMs);
        const requestSignal = signal ? AbortSignal.any([controller.signal, signal]) : controller.signal;
        try {
            if (this.opts.debug) {
                console.debug(`[prosody] POST ${url} (model predict)`);
            }
            this.opts.onRequest?.(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Api-Key ${this.apiKey}` },
                body: JSON.stringify({ audio_base64: audioBase64 }),
            });
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Api-Key ${this.apiKey}`,
                },
                body: JSON.stringify({ audio_base64: audioBase64 }),
                signal: requestSignal,
            });
            clearTimeout(timeout);
            this.opts.onResponse?.(url, res);
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Model predict failed: ${res.status} ${text}`);
            }
            const raw = (await res.json());
            return modelResponseToAnalysisResult(raw);
        }
        finally {
            clearTimeout(timeout);
        }
    }
    async analyze(audio, options, signal) {
        if (this.opts.modelPredictUrl) {
            let base64;
            if (Buffer.isBuffer(audio)) {
                base64 = audio.toString('base64');
            }
            else if (typeof audio === 'string') {
                if (audio.startsWith('http')) {
                    const res = await fetch(audio);
                    const buf = Buffer.from(await res.arrayBuffer());
                    base64 = buf.toString('base64');
                }
                else {
                    const fs = await import('fs');
                    const buffer = fs.readFileSync(audio);
                    base64 = Buffer.from(buffer).toString('base64');
                }
            }
            else {
                throw new Error('analyze(audio): audio must be a Buffer or string (file path or URL)');
            }
            return this.analyzeViaModelPredict(base64, signal);
        }
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
        if (options?.vertical)
            formData.append('vertical', options.vertical);
        if (options?.sessionId)
            formData.append('session_id', options.sessionId);
        if (options?.includeFeatures)
            formData.append('include_features', 'true');
        return postForm('/v1/analyze/audio', this.opts, formData, signal);
    }
    async analyzeBase64(base64Audio, options, signal) {
        if (this.opts.modelPredictUrl) {
            return this.analyzeViaModelPredict(base64Audio, signal);
        }
        return postJSON('/v1/analyze/base64', this.opts, {
            audio_base64: base64Audio,
            language: options?.language,
            vertical: options?.vertical,
            session_id: options?.sessionId,
            output_format: 'json',
        }, signal);
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
    async analyzeWithModel(modelId, audio, options, signal) {
        const formData = new FormData();
        formData.append('model_id', modelId);
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
        return postForm('/v1/analyze/audio', this.opts, formData, signal);
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
        if (options.outcomes?.length) {
            return postJSON('/v1/feedback/session_outcome', this.opts, {
                session_id: options.sessionId,
                outcomes: options.outcomes,
                notes: options.notes,
            }, signal);
        }
        // Legacy path for backward compat
        return postJSON('/v1/feedback/session_outcome', this.opts, {
            session_id: options.sessionId,
            vertical: options.vertical,
            actual_csat: options.actualCsat,
            escalated: options.escalated,
            churned: options.churned,
            first_call_resolved: options.firstCallResolved,
            transferred: options.transferred,
            deal_won: options.dealWon,
            deal_value: options.dealValue,
            days_to_close: options.daysToClose,
            phq_score: options.phqScore,
            intervention_occurred: options.interventionOccurred,
            follow_up_scheduled: options.followUpScheduled,
            final_sentiment: options.finalSentiment,
            notes: options.notes,
        }, signal);
    }
    // ──────────────────────────── Fine-Tuning ────────────────────────
    async createFineTune(config, signal) {
        return postJSON('/v1/fine-tune', this.opts, config, signal);
    }
    async uploadFineTuneSamples(jobId, samples, signal) {
        return postJSON(`/v1/fine-tune/${jobId}/samples`, this.opts, { samples }, signal);
    }
    async startFineTune(jobId, signal) {
        return postJSON(`/v1/fine-tune/${jobId}/start`, this.opts, {}, signal);
    }
    async getFineTune(jobId, signal) {
        return requestJSON('GET', `/v1/fine-tune/${jobId}`, this.opts, null, undefined, signal);
    }
    async listFineTunes(signal) {
        return requestJSON('GET', '/v1/fine-tune', this.opts, null, undefined, signal);
    }
    // ──────────────────────────── Streaming ───────────────────────────
    createStream(options) {
        return new ProsodyStream(this, options);
    }
    createRealtimeStream(options) {
        return new ProsodyRealtimeStream(this, options);
    }
}
