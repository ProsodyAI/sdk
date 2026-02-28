import type {
  AnalysisOptions,
  AnalysisResult,
  PCMOptions,
  StreamingOptions,
  FeedbackCorrectionOptions,
  FeedbackOutcomeOptions,
  SessionOutcomeOptions,
  FineTuneConfig,
  FineTuneJob,
  FineTuneSample,
} from '@/types';
import type { ProsodyClientConfig } from '@/config';
import type { RequestOptions } from '@/http';
import { resolveConfig } from '@/config';
import { createWavBuffer } from '@/wav';
import { postJSON, postForm, requestJSON } from '@/http';
import { ProsodyStream } from '@/stream';
import { ProsodyRealtimeStream } from '@/realtime';

/** Baseten predict response (ProsodySSM Truss). */
interface BasetenPredictResponse {
  error?: string;
  emotion?: string;
  confidence?: number;
  emotion_probabilities?: Record<string, number>;
  valence?: number;
  arousal?: number;
  dominance?: number;
}

function basetenResponseToAnalysisResult(raw: BasetenPredictResponse): AnalysisResult {
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
  private readonly opts: RequestOptions;
  readonly apiKey: string;
  readonly baseUrl: string;

  constructor(config: ProsodyClientConfig | string) {
    const resolved = resolveConfig(config);
    this.apiKey = resolved.apiKey;
    this.baseUrl = resolved.baseUrl;
    this.opts = resolved;
  }

  // ──────────────────────────── Analysis ────────────────────────────

  /** Call Baseten predict URL with Api-Key and { audio_base64 }; map response to AnalysisResult. */
  private async analyzeViaBaseten(audioBase64: string, signal?: AbortSignal): Promise<AnalysisResult> {
    const url = this.opts.basetenPredictUrl!;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.opts.timeoutMs);
    const requestSignal = signal ? AbortSignal.any([controller.signal, signal]) : controller.signal;
    try {
      if (this.opts.debug) {
        console.debug(`[prosody] POST ${url} (Baseten predict)`);
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
        throw new Error(`Baseten predict failed: ${res.status} ${text}`);
      }
      const raw = (await res.json()) as BasetenPredictResponse;
      return basetenResponseToAnalysisResult(raw);
    } finally {
      clearTimeout(timeout);
    }
  }

  async analyze(audio: string | Buffer, options?: AnalysisOptions, signal?: AbortSignal): Promise<AnalysisResult> {
    if (this.opts.basetenPredictUrl) {
      let base64: string;
      if (Buffer.isBuffer(audio)) {
        base64 = audio.toString('base64');
      } else if (typeof audio === 'string') {
        if (audio.startsWith('http')) {
          const res = await fetch(audio);
          const buf = Buffer.from(await res.arrayBuffer());
          base64 = buf.toString('base64');
        } else {
          const fs = await import('fs');
          const buffer = fs.readFileSync(audio);
          base64 = Buffer.from(buffer).toString('base64');
        }
      } else {
        throw new Error('analyze(audio): audio must be a Buffer or string (file path or URL)');
      }
      return this.analyzeViaBaseten(base64, signal);
    }

    const formData = new FormData();

    if (typeof audio === 'string') {
      if (audio.startsWith('http')) {
        formData.append('audio_url', audio);
      } else {
        const fs = await import('fs');
        const buffer = fs.readFileSync(audio);
        formData.append('file', new Blob([buffer]), 'audio.wav');
      }
    } else {
      formData.append('file', new Blob([audio]), 'audio.wav');
    }

    if (options?.language) formData.append('language', options.language);
    if (options?.vertical) formData.append('vertical', options.vertical);
    if (options?.sessionId) formData.append('session_id', options.sessionId);
    if (options?.includeFeatures) formData.append('include_features', 'true');

    return postForm<AnalysisResult>('/v1/analyze/audio', this.opts, formData, signal);
  }

  async analyzeBase64(base64Audio: string, options?: AnalysisOptions, signal?: AbortSignal): Promise<AnalysisResult> {
    if (this.opts.basetenPredictUrl) {
      return this.analyzeViaBaseten(base64Audio, signal);
    }
    return postJSON<AnalysisResult>('/v1/analyze/base64', this.opts, {
      audio_base64: base64Audio,
      language: options?.language,
      vertical: options?.vertical,
      session_id: options?.sessionId,
      output_format: 'json',
    }, signal);
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

  async analyzeWithModel(
    modelId: string,
    audio: string | Buffer,
    options?: AnalysisOptions,
    signal?: AbortSignal,
  ): Promise<AnalysisResult> {
    const formData = new FormData();
    formData.append('model_id', modelId);

    if (typeof audio === 'string') {
      if (audio.startsWith('http')) {
        formData.append('audio_url', audio);
      } else {
        const fs = await import('fs');
        const buffer = fs.readFileSync(audio);
        formData.append('file', new Blob([buffer]), 'audio.wav');
      }
    } else {
      formData.append('file', new Blob([audio]), 'audio.wav');
    }

    if (options?.language) formData.append('language', options.language);

    return postForm<AnalysisResult>('/v1/analyze/audio', this.opts, formData, signal);
  }

  // ──────────────────────────── Features ────────────────────────────

  async extractFeatures(audio: string | Buffer, signal?: AbortSignal): Promise<Record<string, number>> {
    const formData = new FormData();

    if (typeof audio === 'string') {
      if (audio.startsWith('http')) {
        formData.append('audio_url', audio);
      } else {
        const fs = await import('fs');
        const buffer = fs.readFileSync(audio);
        formData.append('file', new Blob([buffer]), 'audio.wav');
      }
    } else {
      formData.append('file', new Blob([audio]), 'audio.wav');
    }

    return postForm<Record<string, number>>('/v1/features/prosody', this.opts, formData, signal);
  }

  // ──────────────────────────── Health ──────────────────────────────

  async health(signal?: AbortSignal): Promise<{ status: string }> {
    return requestJSON<{ status: string }>('GET', '/health', this.opts, null, undefined, signal);
  }

  // ──────────────────────────── Feedback ────────────────────────────

  async submitCorrection(options: FeedbackCorrectionOptions, signal?: AbortSignal): Promise<{ status: string }> {
    return postJSON('/v1/feedback/correction', this.opts, {
      prediction_id: options.predictionId,
      correct_emotion: options.correctEmotion,
      correct_valence: options.correctValence,
      correct_arousal: options.correctArousal,
      correct_dominance: options.correctDominance,
      notes: options.notes,
    }, signal);
  }

  async submitOutcome(options: FeedbackOutcomeOptions, signal?: AbortSignal): Promise<{ status: string }> {
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

  async submitSessionOutcome(options: SessionOutcomeOptions, signal?: AbortSignal): Promise<{ status: string }> {
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

  async createFineTune(config: FineTuneConfig, signal?: AbortSignal): Promise<FineTuneJob> {
    return postJSON('/v1/fine-tune', this.opts, config, signal);
  }

  async uploadFineTuneSamples(jobId: string, samples: FineTuneSample[], signal?: AbortSignal): Promise<{ uploaded: number }> {
    return postJSON(`/v1/fine-tune/${jobId}/samples`, this.opts, { samples }, signal);
  }

  async startFineTune(jobId: string, signal?: AbortSignal): Promise<FineTuneJob> {
    return postJSON(`/v1/fine-tune/${jobId}/start`, this.opts, {}, signal);
  }

  async getFineTune(jobId: string, signal?: AbortSignal): Promise<FineTuneJob> {
    return requestJSON('GET', `/v1/fine-tune/${jobId}`, this.opts, null, undefined, signal);
  }

  async listFineTunes(signal?: AbortSignal): Promise<FineTuneJob[]> {
    return requestJSON('GET', '/v1/fine-tune', this.opts, null, undefined, signal);
  }

  // ──────────────────────────── Streaming ───────────────────────────

  createStream(options?: StreamingOptions): ProsodyStream {
    return new ProsodyStream(this, options);
  }

  createRealtimeStream(options?: StreamingOptions): ProsodyRealtimeStream {
    return new ProsodyRealtimeStream(this, options);
  }
}
