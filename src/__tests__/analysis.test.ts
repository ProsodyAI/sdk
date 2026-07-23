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
        pitch_mean: 184.2,
        energy_mean: 0.13,
      },
      signals: { engagement: 0.78, rapport: 0.82 },
      sequence_signals: {
        engagement_level: 0.76,
        interruption_risk: 0.18,
      },
      timings_ms: {
        mimi_encode: 18.2,
        prosody_inference: 6.4,
        prosody_request: 31.7,
      },
      duration: 64.2,
      word_count: 142,
      kpi_predictions: null,
      alerts: [],
      recommended_actions: [],
      turns: [{
        start_ms: 0,
        end_ms: 4_200,
        speaker_id: 'speaker_0',
        text: 'Thanks for walking me through that.',
        prosody: {
          valence: 0.42,
          arousal: 0.36,
          dominance: 0.58,
          confidence: 0.81,
          signals: { rapport: 0.82 },
        },
      }],
      diarization: {
        model: 'ecapa-embedding-clustering',
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
        signals: { rapport: 0.8 },
        sequence_signals: { interruption_risk: 0.18 },
      }],
      prosody_summary: {
        valence: 0.32,
        arousal: 0.41,
        dominance: 0.55,
        trajectory: {
          valence: 'rising',
          arousal: 'stable',
          dominance: 'stable',
        },
        volatility: {
          valence: 0.08,
          arousal: 0.05,
          dominance: 0.03,
        },
        signals: { rapport: 0.75 },
        sequence_signals: { interruption_risk: 0.18 },
        peak_arousal_ms: 25_000,
        window_count: 13,
      },
      per_speaker: [{
        speaker_id: 'speaker_0',
        talk_ms: 31_000,
        window_count: 7,
        valence: 0.38,
        arousal: 0.39,
        dominance: 0.57,
        signals: { rapport: 0.8 },
      }],
      call_insights: [{
        title: 'Rapport strengthened',
        detail: 'Delivery became steadier relative to the speaker baseline.',
        at_ms: 25_000,
        nearby_text: 'That makes sense now.',
      }],
    });

    expect(result.prosody.valence).toBe(0.42);
    expect(result.sequence_signals?.interruption_risk).toBe(0.18);
    expect(result.timings_ms?.prosody_request).toBe(31.7);
    expect(result.prosody_summary?.trajectory?.valence).toBe('rising');
    expect(result.per_speaker?.[0].speaker_id).toBe('speaker_0');
    expect(result.call_insights?.[0].nearby_text).toBe('That makes sense now.');
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
