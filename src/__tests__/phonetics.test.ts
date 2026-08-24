import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProsodyClient } from '../client.js';

const mockTranscription = {
  ipa: 'noʊp',
  segments: [
    { ipa: 'n', start_s: 0.0, end_s: 0.16, confidence: 0.91 },
    { ipa: 'oʊ', start_s: 0.16, end_s: 0.4, confidence: 0.88 },
    { ipa: 'p', start_s: 0.4, end_s: 0.48, confidence: 0.95 },
  ],
  duration_s: 0.5,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetchOk(body: unknown = mockTranscription) {
  const fn = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('prosody.ipa', () => {
  it('posts the audio file to the phonetics endpoint and returns the transcription', async () => {
    const fetchMock = mockFetchOk();
    const client = new ProsodyClient({ apiKey: 'k', baseUrl: 'http://localhost:8000' });

    const result = await client.ipa(Buffer.from([0, 1, 2, 3]));

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:8000/v1/phonetics/ipa');
    expect(init.method).toBe('POST');
    const form = init.body as FormData;
    expect(form.get('file')).toBeTruthy();

    expect(result.ipa).toBe('noʊp');
    expect(result.segments).toHaveLength(3);
    expect(result.segments[0]).toMatchObject({ ipa: 'n', start_s: 0.0, end_s: 0.16 });
    expect(result.duration_s).toBe(0.5);
  });

  it('refuses a URL instead of silently posting a field the route rejects', async () => {
    mockFetchOk();
    const client = new ProsodyClient({ apiKey: 'k', baseUrl: 'http://localhost:8000' });

    await expect(client.ipa('https://example.com/nope.wav')).rejects.toThrow(
      /requires an uploaded audio file/,
    );
  });
});
