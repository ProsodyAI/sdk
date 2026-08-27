import { resolveLiveSpeakers } from './speaker-resolution.js';
import {
  isKnownSpeaker,
  normalizeSpeakerId,
  overlapMs,
  type ConversationTurn,
  type LiveSegment,
  type StepAnchor,
} from './turn-model.js';
import { prosodyFromState, type Prosody } from './prosody.js';

/** Append one ASR delta onto a turn. Punctuation sticks; words take a space. */
export function appendTranscriptPiece(existing: string, incoming: string): string {
  const piece = incoming.trim();
  if (!piece) return existing;
  if (!existing) return piece;
  if (/^[.,!?;:]/.test(piece)) return `${existing}${piece}`;
  return `${existing} ${piece}`;
}

/** Build speaker-owned turns and attach overlapping vocal measurements.
 *
 * When the model has committed ``turn_boundary`` edges, those are the
 * utterance cuts. Otherwise a committed speaker change opens a turn.
 */
export function buildTurnsFromSegments(
  segments: LiveSegment[],
  steps: StepAnchor[],
  turnBoundaries: number[] = [],
): ConversationTurn[] {
  if (turnBoundaries.length) {
    return buildBoundaryTurns(segments, steps, turnBoundaries);
  }
  const sorted = resolveLiveSpeakers(segments, steps)
    .map((segment) => ({ ...segment }))
    .sort((a, b) => a.start_ms - b.start_ms || a.end_ms - b.end_ms);

  const prosodyAt = (startMs: number, endMs: number): Prosody | null => {
    let best: StepAnchor | null = null;
    let bestOverlap = 0;
    for (const step of steps) {
      const overlap = overlapMs(startMs, endMs, step.timestamp_ms, step.timestamp_ms + 1000);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = step;
      }
    }
    if (!best?.acoustic_state) return null;
    return prosodyFromState(best.acoustic_state, best.acoustic_change);
  };

  const turns: ConversationTurn[] = [];
  for (const seg of sorted) {
    const text = seg.text.trim();
    if (!text) continue;
    const speakerId = normalizeSpeakerId(seg.speaker_id);
    const last = turns[turns.length - 1];
    const speakerChanged = Boolean(last && last.speaker_id !== speakerId);
    const unknownInterim = seg.is_final === false && !isKnownSpeaker(speakerId);
    const shouldStartNew = !last || (speakerChanged && !unknownInterim);
    if (!shouldStartNew && last) {
      last.text = appendTranscriptPiece(last.text, text);
      last.end_ms = Math.max(last.end_ms, seg.end_ms);
      last.final = seg.is_final === true;
      if (!last.prosody) last.prosody = prosodyAt(last.start_ms, last.end_ms);
      continue;
    }
    turns.push({
      speaker_id: speakerId,
      start_ms: seg.start_ms,
      end_ms: seg.end_ms,
      text,
      final: seg.is_final === true,
      prosody: prosodyAt(seg.start_ms, Math.max(seg.start_ms + 1, seg.end_ms)),
    });
  }
  return turns;
}

/** Boundary-to-boundary utterances: one turn per model-committed floor cut. */
function buildBoundaryTurns(
  segments: LiveSegment[],
  steps: StepAnchor[],
  turnBoundaries: number[],
): ConversationTurn[] {
  const edges = [...new Set(turnBoundaries.filter((ms) => Number.isFinite(ms)))].sort(
    (a, b) => a - b,
  );
  const sorted = resolveLiveSpeakers(segments, steps)
    .map((segment) => ({ ...segment }))
    .sort((a, b) => a.start_ms - b.start_ms || a.end_ms - b.end_ms);

  const spanIndex = (ms: number): number => {
    let lo = 0;
    let hi = edges.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ms < edges[mid]) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  };

  type Span = ConversationTurn & { speakerWeights: Map<string, number> };
  const spans = new Map<number, Span>();
  for (const seg of sorted) {
    const text = seg.text.trim();
    if (!text) continue;
    const index = spanIndex(seg.start_ms);
    const speakerId = normalizeSpeakerId(seg.speaker_id);
    const weightMs = Math.max(1, seg.end_ms - seg.start_ms);
    let span = spans.get(index);
    if (!span) {
      span = {
        speaker_id: speakerId,
        start_ms: index === 0 ? seg.start_ms : edges[index - 1],
        end_ms: index < edges.length ? edges[index] : seg.end_ms,
        text: '',
        final: seg.is_final === true,
        speakerWeights: new Map(),
      };
      spans.set(index, span);
    }
    if (isKnownSpeaker(speakerId)) {
      span.speakerWeights.set(speakerId, (span.speakerWeights.get(speakerId) ?? 0) + weightMs);
    }
    span.text = appendTranscriptPiece(span.text, text);
    span.final = seg.is_final === true;
    if (index === 0) span.start_ms = Math.min(span.start_ms, seg.start_ms);
    if (index >= edges.length) span.end_ms = Math.max(span.end_ms, seg.end_ms);
  }

  return [...spans.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, span]) => {
      let bestSpeaker = span.speaker_id;
      let bestWeight = 0;
      for (const [speaker, weight] of span.speakerWeights) {
        if (weight > bestWeight) {
          bestWeight = weight;
          bestSpeaker = speaker;
        }
      }
      const { speakerWeights, ...turn } = span;
      void speakerWeights;
      const covering = steps.find(
        (step) => step.timestamp_ms < turn.end_ms && step.timestamp_ms + 1000 > turn.start_ms,
      );
      return {
        ...turn,
        speaker_id: isKnownSpeaker(bestSpeaker) ? bestSpeaker : turn.speaker_id,
        prosody: covering?.acoustic_state
          ? prosodyFromState(covering.acoustic_state, covering.acoustic_change)
          : turn.prosody,
      };
    });
}
