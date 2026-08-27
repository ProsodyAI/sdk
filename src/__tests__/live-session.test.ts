import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProsodyClient } from '../client.js';
import { LiveSession } from '../live-session.js';

type FakeSocket = {
  readyState: number;
  binaryType: string;
  onopen: ((ev?: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev?: unknown) => void) | null;
  onclose: ((ev: { code: number; reason: string }) => void) | null;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

function installFakeWebSocket() {
  const sockets: FakeSocket[] = [];
  class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    readyState = FakeWebSocket.CONNECTING;
    binaryType = 'blob';
    onopen: FakeSocket['onopen'] = null;
    onmessage: FakeSocket['onmessage'] = null;
    onerror: FakeSocket['onerror'] = null;
    onclose: FakeSocket['onclose'] = null;
    send = vi.fn();
    close = vi.fn(() => {
      this.readyState = FakeWebSocket.CLOSED;
      this.onclose?.({ code: 1000, reason: 'close' });
    });
    constructor(_url: string) {
      sockets.push(this as unknown as FakeSocket);
      queueMicrotask(() => {
        this.readyState = FakeWebSocket.OPEN;
        this.onopen?.({});
      });
    }
  }
  vi.stubGlobal('WebSocket', FakeWebSocket);
  return sockets;
}

function pushJson(socket: FakeSocket, payload: unknown) {
  socket.onmessage?.({ data: JSON.stringify(payload) });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('LiveSession', () => {
  it('start/send/stop owns the socket the demo used to open', async () => {
    const sockets = installFakeWebSocket();
    const client = new ProsodyClient({
      apiKey: 'psk_test',
      baseUrl: 'http://localhost:8080',
    });
    const session = client.stream.session({ source: 'microphone', sampleRate: 16_000 });

    const started = session.start();
    await Promise.resolve();
    expect(sockets).toHaveLength(1);
    pushJson(sockets[0], { type: 'config_ack', session_id: 'sess-1' });
    await started;

    expect(session.sessionId).toBe('sess-1');
    expect(sockets[0].send).toHaveBeenCalled();
    const config = JSON.parse(sockets[0].send.mock.calls[0][0] as string);
    expect(config).toMatchObject({
      type: 'config',
      api_key: 'psk_test',
      encoding: 'pcm16',
      sample_rate: 16_000,
      source: 'microphone',
    });

    session.send(new Int16Array([1, 2, 3, 4]));
    expect(sockets[0].send.mock.calls.length).toBeGreaterThan(1);

    pushJson(sockets[0], {
      type: 'directive',
      session_id: 'sess-1',
      speaker_id: 'speaker_0',
      timestamp_ms: 0,
      acoustic_state: {
        values: { rms_dbfs: -20, f0_median_hz: 140 },
        masks: { f0_available: true },
      },
    });
    pushJson(sockets[0], {
      type: 'transcript_update',
      session_id: 'sess-1',
      result_id: 'r1',
      is_final: true,
      speech_final: true,
      start_ms: 0,
      end_ms: 800,
      segments: [{
        start_ms: 0,
        end_ms: 800,
        speaker_id: 'speaker_0',
        text: 'hello',
        result_id: 'r1',
        is_final: true,
      }],
    });

    const snap = session.snapshot({ prosody: true });
    expect(snap.text).toContain('hello');
    expect(snap.turns[0]?.speaker.id).toBe('speaker_0');

    const stopPromise = session.stop({ waitForSessionEndMs: 1000 });
    pushJson(sockets[0], {
      type: 'session_end',
      session_id: 'sess-1',
      frames_processed: 1,
      transcript: {
        session_id: 'sess-1',
        duration_seconds: 1,
        turns: [{
          start_ms: 0,
          end_ms: 800,
          speaker_id: 'speaker_0',
          text: 'hello',
          segments: [],
          dominant_emotion: '',
          avg_valence: 0,
          avg_arousal: 0,
          avg_dominance: 0,
          prosody: {},
        }],
        segments: [],
        prosody_timeline: [],
        per_speaker: [],
      },
      prosody_timeline: [],
      per_speaker: [],
    });
    await stopPromise;
    expect(session.started).toBe(false);
  });

  it('waitForFrame resolves on directive or frame_ack', async () => {
    const sockets = installFakeWebSocket();
    const session = new LiveSession({
      apiKey: 'k',
      baseUrl: 'http://localhost:8080',
    });
    const started = session.start();
    await Promise.resolve();
    pushJson(sockets[0], { type: 'config_ack', session_id: 's' });
    await started;

    const waiting = session.waitForFrame(1000);
    pushJson(sockets[0], { type: 'frame_ack', session_id: 's' });
    await expect(waiting).resolves.toBeUndefined();
  });

  it('snapshot folds 80 ms words at turn_boundary', async () => {
    const sockets = installFakeWebSocket();
    const session = new LiveSession({
      apiKey: 'k',
      baseUrl: 'http://localhost:8080',
    });
    const started = session.start();
    await Promise.resolve();
    pushJson(sockets[0], { type: 'config_ack', session_id: 's' });
    await started;

    const words = [
      [0, 80, 'Anton'],
      [80, 160, 'Vanko'],
      [160, 240, 'was'],
      [240, 320, 'deported.'],
      [2000, 2080, 'However'],
      [2080, 2160, 'he was'],
      [2160, 2240, 'accused.'],
    ] as const;
    for (const [start_ms, end_ms, text] of words) {
      pushJson(sockets[0], {
        type: 'transcript_update',
        session_id: 's',
        result_id: `model-${start_ms}`,
        is_final: true,
        speech_final: false,
        start_ms,
        end_ms,
        segments: [{
          start_ms,
          end_ms,
          speaker_id: 'speaker_1',
          text,
          is_final: true,
          result_id: `model-${start_ms}`,
        }],
      });
    }
    pushJson(sockets[0], {
      type: 'turn_boundary',
      session_id: 's',
      frame_ms: 2000,
      commit_ms: 2080,
    });

    const snap = session.snapshot();
    expect(snap.turns.map((turn) => turn.text)).toEqual([
      'Anton Vanko was deported.',
      'However he was accused.',
    ]);
    expect(snap.turns.every((turn) => turn.speaker.id === 'speaker_1')).toBe(true);
  });
});
