import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProsodyClient } from '../client.js';
import { ProsodyError, AuthenticationError, RateLimitError } from '../errors.js';

const mockResult = {
  prediction_id: 'pred-1',
  text: 'hello',
  prosody: {
    valence: 0.1,
    arousal: 0.3,
    dominance: 0.5,
  },
  duration: 1.5,
  word_count: 1,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

function mockFetchOk(body: unknown = mockResult) {
  const fn = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) });
  vi.stubGlobal('fetch', fn);
  return fn;
}

function mockFetchError(status: number, body: unknown = {}) {
  const fn = vi.fn().mockResolvedValue({
    ok: false,
    status,
    headers: new Headers(),
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

// ──────────────────────────── Constructor ────────────────────────────

describe('constructor', () => {
  it('accepts string API key with default base URL', () => {
    const client = new ProsodyClient('test-key');
    expect(client.apiKey).toBe('test-key');
    expect(client.baseUrl).toBe('https://api.prosodyai.app');
  });

  it('accepts config object with custom base URL', () => {
    const client = new ProsodyClient({ apiKey: 'k', baseUrl: 'http://localhost:8000' });
    expect(client.apiKey).toBe('k');
    expect(client.baseUrl).toBe('http://localhost:8000');
  });

  it('accepts full config with retry and timeout', () => {
    const client = new ProsodyClient({
      apiKey: 'k',
      timeoutMs: 5000,
      retry: { maxRetries: 5 },
      debug: true,
    });
    expect(client.apiKey).toBe('k');
  });
});
// ──────────────────────────── Health ─────────────────────────────────

describe('health', () => {
  it('calls /health endpoint', async () => {
    const fetch = mockFetchOk({ status: 'ok' });
    const client = new ProsodyClient('key');
    const result = await client.health();
    expect(result).toEqual({ status: 'ok' });
    expect(fetch.mock.calls[0][0]).toBe('https://api.prosodyai.app/health');
  });
});
// ──────────────────────────── Analyze ────────────────────────────────

describe('analyze', () => {
  it('sends API key header', async () => {
    const fetch = mockFetchOk();
    const client = new ProsodyClient('my-key');
    await client.analyze(Buffer.from('audio'));
    expect(fetch.mock.calls[0][1].headers['X-API-Key']).toBe('my-key');
  });

  it('sends to /v1/analyze/audio', async () => {
    const fetch = mockFetchOk();
    const client = new ProsodyClient('key');
    await client.analyze(Buffer.from('audio'));
    expect(fetch.mock.calls[0][0]).toBe('https://api.prosodyai.app/v1/analyze/audio');
  });

  it('appends sessionId and diarize to form data', async () => {
    const fetch = mockFetchOk();
    const client = new ProsodyClient('key');
    await client.analyze(Buffer.from('audio'), { sessionId: 'sess-1' });
    const body = fetch.mock.calls[0][1].body as FormData;
    expect(body.get('session_id')).toBe('sess-1');
    expect(body.get('diarize')).toBe('true');
  });

  it('returns a request-scoped conversation product surface', async () => {
    mockFetchOk({
      ...mockResult,
      affect_available: true,
      turns: [{
        start_ms: 0,
        end_ms: 1_500,
        speaker_id: 'speaker_0',
        text: 'hello',
        prosody: {
          valence: 0.1,
          arousal: 0.3,
          dominance: 0.5,
          confidence: 0.9,
        },
      }],
      per_speaker: [{
        speaker_id: 'speaker_0',
        talk_ms: 1_500,
        window_count: 1,
        valence: 0.1,
        arousal: 0.3,
        dominance: 0.5,
        identity: { person_id: 'not-part-of-the-consumer-view' },
      }],
    });
    const client = new ProsodyClient('key');

    const conversation = await client.conversations.analyze(Buffer.from('audio'));

    expect(conversation.getTranscript()).toBe('hello');
    expect(conversation.getTurn(0)?.speaker_id).toBe('speaker_0');
    expect(conversation.getTurn(0)?.text).toBe('hello');
    expect(conversation.getSpeakers()).toEqual([{
      speaker_id: 'speaker_0',
      talk_ms: 1_500,
      turn_count: 1,
      window_count: 1,
    }]);
    expect(JSON.stringify(conversation.getSpeakers())).not.toMatch(/person|identity/);
  });
});

// ──────────────────────────── analyzeBase64 ─────────────────────────

describe('analyzeBase64', () => {
  it('sends JSON body with base64 audio', async () => {
    const fetch = mockFetchOk();
    const client = new ProsodyClient('key');
    await client.analyzeBase64('dGVzdA==', { sessionId: 'sess-2' });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.prosodyai.app/v1/analyze/base64');
    const body = JSON.parse(init.body);
    expect(body.audio_base64).toBe('dGVzdA==');
    expect(body.session_id).toBe('sess-2');
    expect(body.vertical).toBeUndefined();
  });
});

// ─────────────────────────── Speaker identity ──────────────────────

describe('speaker identity', () => {
  it('lists the tenant speaker directory', async () => {
    const fetch = mockFetchOk({ speakers: [], memory_total: 0, memory_enabled: false });
    const client = new ProsodyClient('key');
    await client.listSpeakers(25);
    expect(fetch.mock.calls[0][0]).toBe('https://api.prosodyai.app/v1/voice/speakers?limit=25');
  });

  it('exposes persistent identity as a developer speaker resource', async () => {
    const fetch = mockFetchOk({ speakers: [], memory_total: 0, memory_enabled: false });
    const client = new ProsodyClient('key');
    await client.speakers.list(10);
    expect(fetch.mock.calls[0][0]).toBe('https://api.prosodyai.app/v1/voice/speakers?limit=10');
  });

  it('previews and confirms an operator-mapped enrollment', async () => {
    const fetch = mockFetchOk({
      preview_sha256: 'sha',
      clusters: [{ speaker_id: 'speaker_0', duration_ms: 3000, segments: [] }],
      requires_explicit_mapping: true,
    });
    const client = new ProsodyClient('key');
    await client.previewSpeakerEnrollment(Buffer.from('audio'));
    expect(fetch.mock.calls[0][0]).toBe(
      'https://api.prosodyai.app/v1/voice/enrollments/preview',
    );

    await client.confirmSpeakerEnrollment(Buffer.from('audio'), 'sha', [{
      speaker_id: 'speaker_0',
      display_name: 'Jacob',
    }]);
    const [url, init] = fetch.mock.calls[1];
    expect(url).toBe('https://api.prosodyai.app/v1/voice/enrollments/confirm');
    const body = init.body as FormData;
    expect(body.get('preview_sha256')).toBe('sha');
    expect(JSON.parse(String(body.get('mapping_json')))).toEqual([{
      speaker_id: 'speaker_0',
      display_name: 'Jacob',
    }]);
  });
});

// ──────────────────────────── Errors ─────────────────────────────────

describe('error handling', () => {
  it('throws AuthenticationError on 401', async () => {
    mockFetchError(401, { message: 'Bad key' });
    const client = new ProsodyClient({ apiKey: 'bad', retry: { maxRetries: 0 } });
    await expect(client.health()).rejects.toThrow(AuthenticationError);
  });

  it('throws RateLimitError on 429 with retry_after_ms', async () => {
    mockFetchError(429, { message: 'Slow down', retry_after_ms: 2000 });
    const client = new ProsodyClient({ apiKey: 'k', retry: { maxRetries: 0 } });
    try {
      await client.health();
    } catch (e: any) {
      expect(e).toBeInstanceOf(RateLimitError);
      expect(e.retryAfterMs).toBe(2000);
    }
  });

  it('throws ProsodyError on 500', async () => {
    mockFetchError(500, { message: 'Internal error' });
    const client = new ProsodyClient({ apiKey: 'k', retry: { maxRetries: 0 } });
    await expect(client.health()).rejects.toThrow(ProsodyError);
  });

  it('retries on 500 then succeeds', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      calls++;
      if (calls === 1) {
        return { ok: false, status: 500, headers: new Headers(), json: () => Promise.resolve({ message: 'fail' }) };
      }
      return { ok: true, json: () => Promise.resolve({ status: 'ok' }) };
    }));
    const client = new ProsodyClient({ apiKey: 'k', retry: { maxRetries: 1, initialDelayMs: 10 } });
    const result = await client.health();
    expect(result).toEqual({ status: 'ok' });
    expect(calls).toBe(2);
  });
});

// ──────────────────────────── Cancellation ───────────────────────────

describe('cancellation', () => {
  it('supports AbortSignal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      await new Promise((_, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
    }));

    const controller = new AbortController();
    const client = new ProsodyClient({ apiKey: 'k', retry: { maxRetries: 0 }, timeoutMs: 60000 });
    const promise = client.health(controller.signal);
    controller.abort();
    await expect(promise).rejects.toThrow();
  });
});

// ──────────────────────────── Feedback ───────────────────────────────

describe('feedback', () => {
  it('submitCorrection posts to /v1/feedback/correction', async () => {
    const fetch = mockFetchOk({ status: 'ok' });
    const client = new ProsodyClient('key');
    await client.submitCorrection({ predictionId: 'p1', correctEmotion: 'angry' });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.prosodyai.app/v1/feedback/correction');
    expect(JSON.parse(init.body).correct_emotion).toBe('angry');
  });

  it('submitSessionOutcome posts to /v1/feedback/session_outcome', async () => {
    const fetch = mockFetchOk({ status: 'ok' });
    const client = new ProsodyClient('key');
    await client.submitSessionOutcome({
      sessionId: 's1',
      outcomes: [{ kpi_id: 'csat', scalar_value: 4 }],
    });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.session_id).toBe('s1');
    expect(body.outcomes).toEqual([{ kpi_id: 'csat', scalar_value: 4 }]);
  });
});
