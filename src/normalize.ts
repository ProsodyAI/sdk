import type { AnalysisResult, ProsodySignals, TurnProsody } from '@/types';

/** API batch nests VAD under `prosody`; realtime may send flat or nested. Normalize to SDK shape. */
export function normalizeAnalysisResult(raw: Record<string, unknown>): AnalysisResult {
  const nested = (raw.prosody && typeof raw.prosody === 'object')
    ? (raw.prosody as Record<string, unknown>)
    : null;

  const valence = numberOr(raw.valence, nested?.valence, 0);
  const arousal = numberOr(raw.arousal, nested?.arousal, 0.5);
  const dominance = numberOr(raw.dominance, nested?.dominance, 0.5);

  return {
    prediction_id: String(raw.prediction_id ?? ''),
    session_id: raw.session_id != null ? String(raw.session_id) : undefined,
    text: String(raw.text ?? ''),
    valence,
    arousal,
    dominance,
    prosody: nested?.prosody as AnalysisResult['prosody'],
    signals: (raw.signals as ProsodySignals | undefined) ?? undefined,
    speaker_id: raw.speaker_id != null ? String(raw.speaker_id) : undefined,
    duration: Number(raw.duration ?? 0),
    word_count: Number(raw.word_count ?? 0),
    format: String(raw.format ?? 'json'),
    turns: Array.isArray(raw.turns)
      ? raw.turns.map((t) => normalizeTurn(t as Record<string, unknown>))
      : undefined,
    prosody_timeline: raw.prosody_timeline as AnalysisResult['prosody_timeline'],
    kpi_predictions: raw.kpi_predictions as AnalysisResult['kpi_predictions'],
    alerts: raw.alerts as AnalysisResult['alerts'],
    vertical_analysis: raw.vertical_analysis as AnalysisResult['vertical_analysis'],
    forward_predictions: raw.forward_predictions as AnalysisResult['forward_predictions'],
    emotion: raw.emotion as AnalysisResult['emotion'],
  };
}

function normalizeTurn(t: Record<string, unknown>): NonNullable<AnalysisResult['turns']>[number] {
  const prosodyRaw = t.prosody;
  let prosody: TurnProsody | undefined;
  if (prosodyRaw && typeof prosodyRaw === 'object') {
    const p = prosodyRaw as Record<string, unknown>;
    prosody = {
      valence: Number(p.valence ?? 0),
      arousal: Number(p.arousal ?? 0.5),
      dominance: Number(p.dominance ?? 0.5),
      confidence: Number(p.confidence ?? 0),
      signals: p.signals as ProsodySignals | undefined,
    };
  }
  return {
    start_ms: Number(t.start_ms ?? 0),
    end_ms: Number(t.end_ms ?? 0),
    speaker_id: String(t.speaker_id ?? ''),
    text: String(t.text ?? ''),
    prosody,
  };
}

function numberOr(...vals: unknown[]): number {
  for (const v of vals) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return Number(vals[vals.length - 1]) || 0;
}
