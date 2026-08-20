import { describe, expect, it } from 'vitest';
import { parseAnalysisResult } from '../analysis.js';

describe('parseAnalysisResult', () => {
  it('preserves the current batch analysis payload', () => {
    const result = parseAnalysisResult({
      prediction_id: 'pred-123',
      session_id: 'call-123',
      text: 'Thanks for walking me through that.',
      prosody: {
        valence: 0.42,
        arousal: 0.36,
        dominance: 0.58,
      },
      transcription: {
        provider: 'nemotron',
        language: 'en',
        word_count: 142,
      },
      timings_ms: {
        mimi_encode: 18.2,
        prosody_inference: 6.4,
        prosody_request: 31.7,
      },
      duration: 64.2,
      word_count: 142,
      turns: [{
        start_ms: 0,
        end_ms: 4_200,
        speaker_id: 'speaker_0',
        text: 'Thanks for walking me through that.',
        prosody: {
          valence: 0.42,
          arousal: 0.36,
          dominance: 0.58,
          acoustic_state: {
            values: { rms_dbfs: -20.8 },
          },
        },
      }],
      diarization: {
        model: 'prosody-speaker-tracker',
        num_speakers: 2,
        speakers: ['speaker_0', 'speaker_1'],
        turns: [],
      },
      prosody_timeline: [{
        start_ms: 0,
        end_ms: 5_000,
        valence: 0.4,
        arousal: 0.35,
        dominance: 0.57,
        acoustic_state: {
          values: { rms_dbfs: -21.4, f0_median_hz: 182.5 },
          masks: { f0_available: true },
        },
      }],
      per_speaker: [{
        speaker_id: 'speaker_0',
        talk_ms: 31_000,
        window_count: 7,
        valence: 0.38,
        arousal: 0.39,
        dominance: 0.57,
      }],
    });

    expect(result.prosody.valence).toBe(0.42);
    expect(result.transcription?.provider).toBe('nemotron');
    expect(result.timings_ms?.prosody_request).toBe(31.7);
    expect(result.prosody_timeline?.[0].acoustic_state?.values?.f0_median_hz).toBe(182.5);
    expect(result.per_speaker?.[0].speaker_id).toBe('speaker_0');
  });

  it('rejects legacy flat VAD responses', () => {
    expect(() => parseAnalysisResult({
      prediction_id: 'pred-legacy',
      text: 'legacy',
      valence: 0.1,
      arousal: 0.2,
      dominance: 0.3,
      duration: 1,
      word_count: 1,
    })).toThrow(/prosody/);
  });
});
