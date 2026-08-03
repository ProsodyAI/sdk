import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ConversationAnalysis, parseAnalysisResult } from '../analysis.js';
import { AcousticWindow } from '../step.js';
import type { DirectiveEvent } from '../types.js';

const production = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('./fixtures/interview-mid90.json', import.meta.url)),
    'utf8',
  ),
) as unknown;

describe('AcousticWindow consumer accessors', () => {
  it('reads pitch / level / voicing from a production timeline window', () => {
    const result = parseAnalysisResult(production);
    const conversation = new ConversationAnalysis(result);
    const windows = conversation.getAcoustics();
    expect(windows).toHaveLength(3);

    const first = windows[0];
    expect(first.getSpeakerId()).toBeTruthy();
    expect(first.getPitchHz()).toBeCloseTo(146.02, 1);
    expect(first.getPitch().available).toBe(true);
    expect(first.getLevel().rmsDbfs).toBeCloseTo(-18.04, 1);
    expect(first.getVoicing().voicedRatio).toBeCloseTo(0.9476, 3);
    expect(first.getVad()).toBeNull();
  });

  it('exposes speaker-relative change after the first step', () => {
    const conversation = new ConversationAnalysis(parseAnalysisResult(production));
    const windows = conversation.getAcoustics();
    expect(windows[0].getChange()).toBeNull();
    expect(windows[1].getDelta('rms_db_change')).toBeCloseTo(2.18, 1);
    expect(conversation.getDeltas()).toHaveLength(2);
  });

  it('getPitch lists voiced F0 across the call', () => {
    const conversation = new ConversationAnalysis(parseAnalysisResult(production));
    const pitch = conversation.getPitch();
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
        affect_available: false,
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
              is_returning: true,
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
      affect_available: false,
      valence: 0,
      arousal: 0,
      dominance: 0,
      prosody: { valence: 0, arousal: 0, dominance: 0 },
      acoustic_state: {
        values: { f0_median_hz: 180, rms_dbfs: -22, voiced_ratio: 0.8 },
        masks: { f0_available: true },
      },
      acoustic_change: null,
      text: '',
      frames_processed: 8,
      timings_ms: {},
      is_overlap: false,
      speaker_changed: false,
      speech_ratio: 1,
      speaker_activity_available: true,
      num_speakers: 1,
      diar_segments: [],
      phonemes: [],
      ipa_transcript: '',
      prosody_embedding: null,
      forward_prediction: null,
      modulation_mode: 'normal',
      is_escalating: false,
      is_interrupting: false,
      should_yield: false,
      is_steering: false,
      tts_speed: 1,
    } as DirectiveEvent;

    const window = AcousticWindow.fromDirective(directive);
    expect(window.getPitchHz()).toBe(180);
    expect(window.getLevel().rmsDbfs).toBe(-22);
    expect(window.getVad()).toBeNull();
  });

  it('exposes Mimi-aligned frame trajectories from a live window', () => {
    const window = AcousticWindow.fromDirective({
      type: 'directive',
      session_id: 's1',
      speaker_id: 'speaker_0',
      timestamp_ms: 1000,
      affect_available: false,
      valence: 0,
      arousal: 0,
      dominance: 0,
      prosody: { valence: 0, arousal: 0, dominance: 0 },
      acoustic_state: {
        values: { rms_dbfs: -22 },
        frames: {
          frame_rate_hz: 12.5,
          rms_dbfs: [-24, -22],
          f0_hz: [null, 180],
        },
      },
      text: '', frames_processed: 2, timings_ms: {}, is_overlap: false,
      speaker_changed: false, speech_ratio: 1, speaker_activity_available: true,
      num_speakers: 1, diar_segments: [], phonemes: [], ipa_transcript: '',
      prosody_embedding: null, forward_prediction: null, modulation_mode: 'normal',
      is_escalating: false, is_interrupting: false, should_yield: false,
      is_steering: false, tts_speed: 1,
    } as DirectiveEvent);

    expect(window.getFrameSeries('f0_hz')).toEqual([
      { timeMs: 0, value: null },
      { timeMs: 80, value: 180 },
    ]);
  });
});
