import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ConversationAnalysis, parseAnalysisResult } from '../analysis.js';
import { VoiceFrame } from '../step.js';
import type { DirectiveEvent } from '../types.js';

const production = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('./fixtures/interview-mid90.json', import.meta.url)),
    'utf8',
  ),
) as unknown;

describe('VoiceFrame consumer accessors', () => {
  it('reads intonation / stress / rhythm from a production timeline window', () => {
    const result = parseAnalysisResult(production);
    const conversation = new ConversationAnalysis(result);
    const windows = conversation.getFrames();
    expect(windows).toHaveLength(3);

    const first = windows[0];
    expect(first.getSpeakerId()).toBeTruthy();
    expect(first.state?.intonation.pitch).toBeCloseTo(146.02, 1);
    expect(first.state?.stress.loudness).toBeCloseTo(-18.04, 1);
    expect(first.state?.rhythm.voiced).toBeCloseTo(0.9476, 3);
    expect(first.vad?.valence).toBeCloseTo(0.1358, 3);
    expect(first.vad?.arousal).toBeCloseTo(0.5178, 3);
    expect(first.vad?.dominance).toBeCloseTo(0.6265, 3);
  });

  it('exposes speaker-relative change after the first step', () => {
    const conversation = new ConversationAnalysis(parseAnalysisResult(production));
    const windows = conversation.getFrames();
    expect(windows[0].change).toBeNull();
    expect(windows[1].change?.stress.loudness).toBeCloseTo(2.18, 1);
    expect(conversation.getChanges()).toHaveLength(2);
  });

  it('lists intonation pitch across the call', () => {
    const conversation = new ConversationAnalysis(parseAnalysisResult(production));
    const pitch = conversation.getMeasurementSeries('intonation.pitch');
    expect(pitch).toHaveLength(3);
    expect(pitch[0].value).toBeCloseTo(146.02, 1);
  });

  it('keeps durable identity out of the conversation speaker surface', () => {
    const conversation = new ConversationAnalysis(
      parseAnalysisResult({
        prediction_id: 'p',
        text: 'hi',
        duration: 1,
        word_count: 1,
        prosody: { valence: 0, arousal: 0, dominance: 0 },
        per_speaker: [
          {
            speaker_id: 'speaker_0',
            talk_ms: 1000,
            window_count: 1,
            valence: 0,
            arousal: 0,
            dominance: 0,
            identity: {
              person_id: 'person_abc',
              resumed: true,
              display_name: 'Alex',
            },
          },
        ],
      }),
    );
    const speakers = conversation.getSpeakers();
    expect(speakers).toEqual([{
      speaker_id: 'speaker_0',
      talk_ms: 1000,
      window_count: 1,
      turn_count: 0,
    }]);
    expect(JSON.stringify(speakers)).not.toMatch(/person|identity|embedding|voiceprint/);
  });

  it('fromDirective maps a live step the same way', () => {
    const directive = {
      type: 'directive',
      session_id: 's1',
      speaker_id: 'speaker_0',
      timestamp_ms: 8000,
      valence: null,
      arousal: null,
      dominance: null,
      prosody: { valence: null, arousal: null, dominance: null },
      acoustic_state: {
        values: { f0_median_hz: 180, rms_dbfs: -22, voiced_ratio: 0.8 },
        masks: { f0_available: true },
      },
      acoustic_change: null,
      text: '',
      frames_processed: 8,
      timings_ms: {},
      speaker_changed: false,
      num_speakers: 1,
      diar_segments: [],
      phonemes: [],
      ipa_transcript: '',
      prosody_embedding: null,
    } as DirectiveEvent;

    const window = VoiceFrame.fromDirective(directive);
    expect(window.state?.intonation.pitch).toBe(180);
    expect(window.state?.stress.loudness).toBe(-22);
    expect(window.vad).toBeNull();
  });

  it('maps the measurement bundle to family-shaped names', () => {
    const window = VoiceFrame.fromDirective({
      type: 'directive',
      session_id: 's1',
      speaker_id: 'speaker_0',
      timestamp_ms: 1000,
      valence: null,
      arousal: null,
      dominance: null,
      prosody: { valence: null, arousal: null, dominance: null },
      acoustic_state: {
        values: { rms_dbfs: -22, f0_median_hz: 180 },
        masks: { f0_available: true },
      },
      acoustic_change: { values: { rms_db_change: 1.5 }, reference: 'previous_chunk' },
      text: '', frames_processed: 2, timings_ms: {},
      speaker_changed: false,
      num_speakers: 1, diar_segments: [], phonemes: [], ipa_transcript: '',
      prosody_embedding: null,
    } as DirectiveEvent);

    const prosody = window.getProsody();
    expect(prosody?.state.stress.loudness).toBe(-22);
    expect(prosody?.state.intonation.pitch).toBe(180);
    expect(prosody?.change?.stress.loudness).toBe(1.5);
    expect(window.getChange()?.reference).toBe('previous_chunk');
  });
});
