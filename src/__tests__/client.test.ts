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

  it('rejects an empty API key', () => {
    expect(() => new ProsodyClient('')).toThrow(/non-empty apiKey/);
    expect(() => new ProsodyClient({ apiKey: '   ' })).toThrow(/non-empty apiKey/);
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

// ──────────────────── One-call readouts (batch) ────────────────────

describe('one-call readouts', () => {
  const diarizedResult = {
    ...mockResult,
    turns: [
      { start_ms: 0, end_ms: 2_480, speaker_id: 'speaker_0', text: 'first turn' },
      { start_ms: 2_480, end_ms: 4_960, speaker_id: 'speaker_1', text: 'second turn' },
    ],
    diarization: {
      model: 'prosodyssm',
      num_speakers: 2,
      speakers: ['speaker_0', 'speaker_1'],
      turns: [
        { start_ms: 0, end_ms: 2_480, speaker: 'speaker_0' },
        { start_ms: 2_480, end_ms: 4_960, speaker: 'speaker_1' },
      ],
    },
    events: [
      { type: 'turn_boundary', frame_ms: 2_480, commit_ms: 2_560 },
      { type: 'barge_in', frame_ms: 3_120, commit_ms: 3_200, duration_ms: 640, resolved: true },
    ],
    per_speaker: [
      { speaker_id: 'speaker_0', talk_ms: 2_480, window_count: 1 },
      { speaker_id: 'speaker_1', talk_ms: 2_480, window_count: 1 },
    ],
  };

  it('getTurns returns diarized turns with text', async () => {
    mockFetchOk(diarizedResult);
    const client = new ProsodyClient('key');
    const turns = await client.getTurns(Buffer.from('audio'));
    expect(turns).toHaveLength(2);
    expect(turns[0]).toMatchObject({ speaker_id: 'speaker_0', start_ms: 0, end_ms: 2_480, text: 'first turn' });
    expect(turns[1]?.speaker_id).toBe('speaker_1');
  });

  it('getTurnBoundaries returns the diarization skeleton without text', async () => {
    mockFetchOk(diarizedResult);
    const client = new ProsodyClient('key');
    const boundaries = await client.getTurnBoundaries(Buffer.from('audio'));
    expect(boundaries).toEqual([
      { speaker_id: 'speaker_0', start_ms: 0, end_ms: 2_480 },
      { speaker_id: 'speaker_1', start_ms: 2_480, end_ms: 4_960 },
    ]);
    expect(JSON.stringify(boundaries)).not.toMatch(/text/);
  });

  it('getTurnBoundaries falls back to transcript turns when no diarization block', async () => {
    const { diarization: _diarization, ...withoutDiarization } = diarizedResult;
    mockFetchOk(withoutDiarization);
    const client = new ProsodyClient('key');
    const boundaries = await client.getTurnBoundaries(Buffer.from('audio'));
    expect(boundaries).toEqual([
      { speaker_id: 'speaker_0', start_ms: 0, end_ms: 2_480 },
      { speaker_id: 'speaker_1', start_ms: 2_480, end_ms: 4_960 },
    ]);
  });

  it('getEvents returns committed events in order', async () => {
    mockFetchOk(diarizedResult);
    const client = new ProsodyClient('key');
    const events = await client.getEvents(Buffer.from('audio'));
    expect(events).toEqual([
      { type: 'turn_boundary', frame_ms: 2_480, commit_ms: 2_560 },
      { type: 'barge_in', frame_ms: 3_120, commit_ms: 3_200, duration_ms: 640, resolved: true },
    ]);
  });

  it('getEvents returns an empty list when the response carries none', async () => {
    mockFetchOk(mockResult);
    const client = new ProsodyClient('key');
    await expect(client.getEvents(Buffer.from('audio'))).resolves.toEqual([]);
  });

  it('getSpeakers returns recording-local speakers with accounting', async () => {
    mockFetchOk(diarizedResult);
    const client = new ProsodyClient('key');
    const speakers = await client.getSpeakers(Buffer.from('audio'));
    expect(speakers).toEqual([
      { speaker_id: 'speaker_0', talk_ms: 2_480, turn_count: 1, window_count: 1 },
      { speaker_id: 'speaker_1', talk_ms: 2_480, turn_count: 1, window_count: 1 },
    ]);
  });
});

// ─────────────────────────── Transcribe ──────────────────────────────

describe('transcribe', () => {
  it('returns text and turns with prosody by default', async () => {
    mockFetchOk({
      ...mockResult,
      affect_available: true,
      acoustic_state: {
        provenance: { schema_version: 'prosody_output/v2', values_unit: 'physical' },
        values: {
          rms_dbfs: -24,
          peak_dbfs: -12,
          f0_median_hz: 180,
          f0_range_semitones: 2,
          f0_slope_semitones_per_second: 0.1,
          spectral_tilt_db_per_octave: -12,
          voiced_ratio: 0.8,
          pause_ratio: 0.1,
          clipping_ratio: 0,
          voice_onset_rate_hz: 1.2,
        },
        masks: {},
        frames: {},
      },
      turns: [{
        start_ms: 0,
        end_ms: 1_500,
        speaker_id: 'speaker_0',
        text: 'hello',
        prosody: {
          acoustic_state: {
            provenance: { schema_version: 'prosody_output/v2', values_unit: 'physical' },
            values: {
              rms_dbfs: -24,
              peak_dbfs: -12,
              f0_median_hz: 180,
              f0_range_semitones: 2,
              f0_slope_semitones_per_second: 0.1,
              spectral_tilt_db_per_octave: -12,
              voiced_ratio: 0.8,
              pause_ratio: 0.1,
              clipping_ratio: 0,
              voice_onset_rate_hz: 1.2,
            },
            masks: { f0_available: true },
            frames: {},
          },
        },
      }],
      per_speaker: [{
        speaker_id: 'speaker_0',
        talk_ms: 1_500,
        window_count: 1,
      }],
    });
    const client = new ProsodyClient('key');
    const result = await client.transcribe(Buffer.from('audio'), { prosody: true });

    expect(result.text).toBe('hello');
    expect(result.turns[0]?.text).toBe('hello');
    expect(result.turns[0]?.prosody?.state.intonation.pitch).toBe(180);
    expect(result.turns[0]?.prosody?.state.stress.loudness).toBe(-24);
    expect(result.turns[0]?.prosody?.state.tilt).toBe(-12);
    expect(result.turns[0]?.prosody?.state.intonation.pitch).not.toBeNull();
    expect(result.conversation.getTranscript()).toBe('hello');

    const speaker = result.turns[0]!.speaker;
    expect(speaker.id).toBe('speaker_0');
    expect(speaker.label).toBe('Speaker 1');
    expect(speaker.isUnknown).toBe(false);
    // Turns hold the same instance the result lists.
    expect(result.getSpeaker('speaker_0')).toBe(speaker);
    expect(result.speakers[0]).toBe(speaker);
    expect(result.turnsBySpeaker(speaker)).toHaveLength(1);
  });

  it('omits turn.prosody when prosody: false', async () => {
    mockFetchOk({
      ...mockResult,
      turns: [{
        start_ms: 0,
        end_ms: 1_500,
        speaker_id: 'speaker_0',
        text: 'hello',
      }],
      per_speaker: [{ speaker_id: 'speaker_0', talk_ms: 1_500, window_count: 1 }],
    });
    const client = new ProsodyClient('key');
    const result = await client.transcribe(Buffer.from('audio'), { prosody: false });
    expect(result.turns[0]?.speaker.id).toBe('speaker_0');
    expect(result.turns[0]).not.toHaveProperty('prosody');
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
      lanes: [{ speaker_id: 'speaker_0', duration_ms: 3000, segments: [] }],
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

// ──────────────────────────── Memory ───────────────────────────────

describe('memory', () => {
  it('recalls a person\'s significant moments, recency-ranked', async () => {
    const fetch = mockFetchOk({ person_id: 'p1', is_returning: true, memories: [], preamble: '' });
    const client = new ProsodyClient('key');
    const result = await client.memory.recall.post('p1', 10);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.prosodyai.app/v1/memory/recall');
    expect(JSON.parse(init.body)).toEqual({ person_id: 'p1', top_k: 10, include_recent: true });
    expect(result.is_returning).toBe(true);
  });

  it('defaults topK to the route default', async () => {
    const fetch = mockFetchOk({ person_id: 'p1', is_returning: false, memories: [], preamble: '' });
    const client = new ProsodyClient('key');
    await client.memory.recall.post('p1');
    expect(JSON.parse(fetch.mock.calls[0][1].body).top_k).toBe(5);
  });

  it('rejects an out-of-range topK before any request', async () => {
    const fetch = mockFetchOk();
    const client = new ProsodyClient('key');
    await expect(client.memory.recall.post('p1', 0)).rejects.toThrow('integer from 1 to 50');
    expect(fetch).not.toHaveBeenCalled();
  });
});

// ──────────────────────────── Feedback ───────────────────────────────

describe('feedback', () => {
  it('submitCorrection sends the exact correction wire keys', async () => {
    const fetch = mockFetchOk({ status: 'ok' });
    const client = new ProsodyClient('key');
    await client.submitCorrection({
      predictionId: 'p1',
      correctedValence: 0,
      correctedArousal: 0.25,
      correctedDominance: 0.5,
      notes: 'reviewed',
    });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.prosodyai.app/v1/feedback/correction');
    expect(JSON.parse(init.body)).toEqual({
      prediction_id: 'p1',
      corrected_valence: 0,
      corrected_arousal: 0.25,
      corrected_dominance: 0.5,
      notes: 'reviewed',
    });
  });

  it('submitCorrection requires at least one corrected value', async () => {
    const fetch = mockFetchOk({ status: 'ok' });
    const client = new ProsodyClient('key');

    await expect(client.submitCorrection({ predictionId: 'p1' })).rejects.toThrow(
      'submitCorrection requires at least one corrected value',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['correctedValence', { correctedValence: -1.01 }],
    ['correctedValence', { correctedValence: Number.NaN }],
    ['correctedArousal', { correctedArousal: 1.01 }],
    ['correctedDominance', { correctedDominance: -0.01 }],
  ] as const)('submitCorrection rejects invalid %s values', async (field, correction) => {
    const fetch = mockFetchOk({ status: 'ok' });
    const client = new ProsodyClient('key');

    await expect(client.submitCorrection({ predictionId: 'p1', ...correction })).rejects.toThrow(
      `${field} must be a finite number`,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not expose the removed single-prediction outcome endpoint', () => {
    const client = new ProsodyClient('key');
    expect('submitOutcome' in client).toBe(false);
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
