import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProsodyStream } from '@/stream';
import type { ProsodyClient } from '@/client';

function makeMockClient(): ProsodyClient {
  return {
    analyzePCM: vi.fn().mockResolvedValue({
      prediction_id: 'p1',
      text: '',
      emotion: { primary: 'neutral', confidence: 0.8, probabilities: {} },
      valence: 0.0,
      arousal: 0.3,
      dominance: 0.5,
      duration: 3.0,
      word_count: 0,
      format: 'json',
    }),
  } as unknown as ProsodyClient;
}

describe('ProsodyStream', () => {
  it('does not process until chunk threshold is reached', () => {
    const client = makeMockClient();
    const stream = new ProsodyStream(client, { sampleRate: 16000, chunkDuration: 3 });

    stream.push(new Float32Array(1000));
    expect(client.analyzePCM).not.toHaveBeenCalled();
  });

  it('auto-processes when buffer reaches chunk size', () => {
    const client = makeMockClient();
    const stream = new ProsodyStream(client, { sampleRate: 16000, chunkDuration: 1 });

    stream.push(new Float32Array(16000));
    expect(client.analyzePCM).toHaveBeenCalledTimes(1);
  });

  it('flush processes remaining buffer', async () => {
    const client = makeMockClient();
    const stream = new ProsodyStream(client, { sampleRate: 16000, chunkDuration: 3 });

    stream.push(new Float32Array(1000));
    const result = await stream.flush();

    expect(client.analyzePCM).toHaveBeenCalledTimes(1);
    expect(result).not.toBeNull();
    expect(result!.prediction_id).toBe('p1');
  });

  it('flush returns null on empty buffer', async () => {
    const client = makeMockClient();
    const stream = new ProsodyStream(client, { sampleRate: 16000, chunkDuration: 3 });

    const result = await stream.flush();
    expect(result).toBeNull();
  });

  it('clear empties the buffer', async () => {
    const client = makeMockClient();
    const stream = new ProsodyStream(client, { sampleRate: 16000, chunkDuration: 3 });

    stream.push(new Float32Array(1000));
    stream.clear();
    const result = await stream.flush();

    expect(result).toBeNull();
    expect(client.analyzePCM).not.toHaveBeenCalled();
  });

  it('calls onResult callback', async () => {
    const client = makeMockClient();
    const onResult = vi.fn();
    const stream = new ProsodyStream(client, { sampleRate: 16000, chunkDuration: 3, onResult });

    stream.push(new Float32Array(100));
    await stream.flush();

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0][0].prediction_id).toBe('p1');
  });

  it('accepts Int16Array input', () => {
    const client = makeMockClient();
    const stream = new ProsodyStream(client, { sampleRate: 16000, chunkDuration: 1 });

    stream.push(new Int16Array(16000));
    expect(client.analyzePCM).toHaveBeenCalledTimes(1);
  });
});
