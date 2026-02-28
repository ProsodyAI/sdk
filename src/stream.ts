import type { AnalysisResult, StreamingOptions } from '@/types';
import type { ProsodyClient } from '@/client';

export class ProsodyStream {
  private client: ProsodyClient;
  private options: StreamingOptions;
  private buffer: Float32Array[] = [];
  private sampleCount = 0;
  private samplesPerChunk: number;
  private processing = false;

  constructor(client: ProsodyClient, options?: StreamingOptions) {
    this.client = client;
    this.options = options || {};
    const sampleRate = options?.sampleRate || 16000;
    const chunkDuration = options?.chunkDuration || 3;
    this.samplesPerChunk = sampleRate * chunkDuration;
  }

  push(samples: Float32Array | Int16Array): void {
    const float32 = samples instanceof Int16Array
      ? new Float32Array(samples.length).map((_, i) => samples[i] / 32768)
      : samples;

    this.buffer.push(float32);
    this.sampleCount += float32.length;

    if (this.sampleCount >= this.samplesPerChunk && !this.processing) {
      this.processChunk();
    }
  }

  async flush(): Promise<AnalysisResult | null> {
    if (this.sampleCount === 0) return null;
    return this.processChunk(true);
  }

  clear(): void {
    this.buffer = [];
    this.sampleCount = 0;
  }

  private async processChunk(flush = false): Promise<AnalysisResult | null> {
    if (this.processing && !flush) return null;
    this.processing = true;

    try {
      const totalLength = this.buffer.reduce((sum, arr) => sum + arr.length, 0);
      const combined = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of this.buffer) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      this.buffer = [];
      this.sampleCount = 0;

      const result = await this.client.analyzePCM(combined, this.options);

      if (this.options.onResult) {
        this.options.onResult(result);
      }

      return result;
    } catch (error) {
      if (this.options.onError) {
        this.options.onError(error as Error);
      }
      throw error;
    } finally {
      this.processing = false;
    }
  }
}
