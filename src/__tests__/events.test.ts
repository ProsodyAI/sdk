import { describe, expect, it } from 'vitest';
import { parseProsodyEvent } from '../events.js';

describe('parseProsodyEvent', () => {
  it('preserves the current directive contract', () => {
    const event = parseProsodyEvent({
      session_id: 'call-123',
      generation: 4,
      seq: 12,
      type: 'directive',
      prosody: { valence: -0.2, arousal: 0.8, dominance: 0.6 },
      valence: -0.2,
      arousal: 0.8,
      dominance: 0.6,
      acoustic_state: {
        values: { rms_dbfs: -32.5, f0_median_hz: 180.0, voiced_ratio: 0.6 },
        masks: { f0_available: true },
      },
      acoustic_change: null,
      timings_ms: { mimi_encode: 9.1, prosody_inference: 4.3, chunk_total: 22.4 },
      text: 'I have already called twice.',
      frames_processed: 8,
      timestamp_ms: 8_000,
      speaker_id: 'caller',
      speaker_changed: true,
      num_speakers: 2,
      diar_segments: [],
      phonemes: [],
      ipa_transcript: '',
      prosody_embedding: null,
    });

    expect(event.type).toBe('directive');
    if (event.type !== 'directive') throw new Error('unexpected event');
    expect(event.timings_ms.chunk_total).toBe(22.4);
    expect(event.acoustic_state?.values?.rms_dbfs).toBe(-32.5);
    expect(event.valence).toBe(-0.2);
    expect(event.arousal).toBe(0.8);
    expect(event.dominance).toBe(0.6);
  });

  it('accepts the current wire envelope without generation or sequence', () => {
    const event = parseProsodyEvent({
      session_id: 'call-123',
      type: 'directive',
    });
    expect(event.session_id).toBe('call-123');
  });
});
