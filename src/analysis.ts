import type { AnalysisResult } from './types.js';

/** Validate the stable batch envelope while preserving all current API fields. */
export function parseAnalysisResult(value: unknown): AnalysisResult {
  if (!isRecord(value)) {
    throw new Error('Analysis result must be a JSON object');
  }
  if (typeof value.prediction_id !== 'string' || !value.prediction_id) {
    throw new Error('Analysis result missing prediction_id');
  }
  if (typeof value.text !== 'string') {
    throw new Error('Analysis result missing text');
  }
  if (!isRecord(value.prosody)) {
    throw new Error('Analysis result missing prosody');
  }

  for (const field of ['valence', 'arousal', 'dominance'] as const) {
    if (typeof value.prosody[field] !== 'number') {
      throw new Error(`Analysis result prosody.${field} must be a number`);
    }
  }
  if (typeof value.duration !== 'number' || typeof value.word_count !== 'number') {
    throw new Error('Analysis result missing audio metadata');
  }

  return value as unknown as AnalysisResult;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
