import type { SessionTranscript, StreamingOptions } from '@/types';
import type { ProsodyClient } from '@/client';
import { normalizeAnalysisResult } from '@/normalize';

export class ProsodyRealtimeStream {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private baseUrl: string;
  private options: StreamingOptions;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private _resolveEnd: (() => void) | null = null;

  constructor(client: ProsodyClient, options?: StreamingOptions) {
    this.apiKey = (client as any).apiKey;
    this.baseUrl = (client as any).baseUrl;
    this.options = options || {};
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.baseUrl
        .replace('https://', 'wss://')
        .replace('http://', 'ws://');

      this.ws = new WebSocket(`${wsUrl}/v1/stream/realtime`);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.ws?.send(JSON.stringify({
          type: 'config',
          api_key: this.apiKey,
          language: this.options.language || 'en',
          vertical: this.options.vertical,
          session_id: this.options.sessionId,
          sample_rate: this.options.sampleRate || 16000,
          encoding: this.options.encoding || 'pcm16',
          // Server field is chunk_seconds (default 1); ignored if absent.
          chunk_seconds: this.options.chunkDuration ?? 1,
        }));
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onerror = () => {
        reject(new Error('WebSocket connection failed'));
      };

      this.ws.onclose = (event) => {
        if (event.code === 4001) {
          this.options.onError?.(new Error('Invalid API key'));
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'directive' || message.type === 'result') {
            this.options.onResult?.(normalizeAnalysisResult(message));
          } else if (message.type === 'session_end') {
            if (message.transcript) {
              const transcript: SessionTranscript = {
                session_id: message.session_id ?? message.transcript.session_id,
                duration_seconds: message.transcript.duration_seconds ?? 0,
                turns: message.transcript.turns ?? [],
                segments: message.transcript.segments,
              };
              this.options.onTranscript?.(transcript);
            }
            this._resolveEnd?.();
          } else if (message.type === 'escalation_alert') {
            this.options.onEscalationAlert?.({
              onset_probability: message.onset_probability,
              recommended_tone: message.recommended_tone,
              segment_id: message.segment_id,
            });
          } else if (message.type === 'error') {
            this.options.onError?.(new Error(message.message));
          }
        } catch (e) {
          this.options.onError?.(e as Error);
        }
      };
    });
  }

  send(samples: Float32Array | Int16Array | ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected. Call connect() first.');
    }

    let int16Samples: Int16Array;
    if (samples instanceof Float32Array) {
      int16Samples = new Int16Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        int16Samples[i] = Math.max(-32768, Math.min(32767, samples[i] * 32768));
      }
    } else if (samples instanceof ArrayBuffer) {
      int16Samples = new Int16Array(samples);
    } else {
      int16Samples = samples;
    }

    const buf = int16Samples.buffer.slice(
      int16Samples.byteOffset,
      int16Samples.byteOffset + int16Samples.byteLength,
    );
    this.ws.send(buf);
  }

  async end(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        resolve();
        return;
      }

      this._resolveEnd = () => {
        this._resolveEnd = null;
        this.ws?.close();
        resolve();
      };

      this.ws.send(JSON.stringify({ type: 'end' }));
    });
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
