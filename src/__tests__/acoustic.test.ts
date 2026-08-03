import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { acousticSeries, acousticWindows, parseAnalysisResult } from '../analysis.js';

/**
 * Captured from production: POST /v1/analyze/audio with diarize=true on 90s of
 * a real two-person interview. Trimmed to three windows; values untouched.
 */
const production = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('./fixtures/interview-mid90.json', import.meta.url)),
    'utf8',
  ),
) as unknown;

describe('acoustic output from a real deployment', () => {
  it('parses the production batch response', () => {
    const result = parseAnalysisResult(production);
    expect(result.prediction_id).toBeTruthy();
    expect(result.duration).toBe(90);
  });

  it('exposes the measured windows the model produced', () => {
    const result = parseAnalysisResult(production);
    const windows = acousticWindows(result);
    expect(windows).toHaveLength(3);

    const first = windows[0].acoustic_state?.values;
    expect(first?.rms_dbfs).toBeCloseTo(-18.04, 1);
    expect(first?.f0_median_hz).toBeCloseTo(146.02, 1);
    expect(first?.voiced_ratio).toBeCloseTo(0.9476, 3);
    expect(windows[0].acoustic_state?.masks?.f0_available).toBe(true);
  });

  it('reports speaker-relative movement after the first window', () => {
    const result = parseAnalysisResult(production);
    const windows = acousticWindows(result);
    expect(windows[0].acoustic_change ?? null).toBeNull();
    expect(windows[1].acoustic_change?.values?.rms_db_change).toBeCloseTo(2.18, 1);
    expect(windows[1].acoustic_change?.reference).toContain('previous_chunk');
  });

  it('reads one feature across the call', () => {
    const result = parseAnalysisResult(production);
    const series = acousticSeries(result, 'f0_median_hz');
    expect(series).toHaveLength(3);
    expect(series.every((point) => point.end_ms > point.start_ms)).toBe(true);
  });

  it('attaches the measurement to each diarized turn', () => {
    const result = parseAnalysisResult(production);
    const turn = (result.turns ?? [])[0];
    expect(turn.speaker_id).toBe('speaker_0');
    expect(turn.prosody?.acoustic_state?.values?.rms_dbfs).toBeCloseTo(-18.04, 1);
  });
});

describe('affect is not required to be a measurement', () => {
  const base = {
    prediction_id: 'pred-1',
    text: 'hello',
    duration: 5,
    word_count: 1,
  };

  it('accepts a response whose checkpoint publishes no affect', () => {
    const result = parseAnalysisResult({
      ...base,
      affect_available: false,
      prosody: { valence: 0, arousal: 0, dominance: 0 },
      prosody_timeline: [
        { start_ms: 0, end_ms: 5000, valence: 0, arousal: 0, dominance: 0,
          acoustic_state: { values: { rms_dbfs: -20.5 } } },
      ],
    });
    expect(result.affect_available).toBe(false);
    expect(acousticSeries(result, 'rms_dbfs')[0].value).toBe(-20.5);
  });

  it('rejects a response that claims affect but omits the numbers', () => {
    expect(() =>
      parseAnalysisResult({ ...base, affect_available: true, prosody: { valence: 0.2 } }),
    ).toThrow(/affect_available/);
  });
});
