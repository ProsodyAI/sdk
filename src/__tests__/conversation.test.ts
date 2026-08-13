import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseAnalysisResult } from '../analysis.js';
import { Conversation } from '../conversation.js';

const production = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('./fixtures/interview-mid90.json', import.meta.url)),
    'utf8',
  ),
) as unknown;

describe('Conversation', () => {
  it('batch: diarized turns + getProsody', () => {
    const conversation = Conversation.fromAnalysis(parseAnalysisResult(production));
    const turns = conversation.getTurns();
    expect(turns.length).toBeGreaterThan(0);
    expect(turns[0].speaker_id).toBeTruthy();
    expect(turns[0].text).toBeTruthy();
    expect(turns[0].prosody?.loudnessDbfs).toBeCloseTo(-18.04, 1);
    expect(conversation.getProsody()?.pitchHz).toBeCloseTo(
      conversation.getAcoustics().at(-1)?.getPitchHz() ?? NaN,
      1,
    );
    expect(conversation.getSpeakers()).toEqual([{
      speaker_id: 'speaker_0',
      talk_ms: 90_000,
      turn_count: 1,
      window_count: 18,
    }]);
    expect(conversation.getMeasurementSeries('loudnessDbfs')).toHaveLength(3);
    expect(conversation.getMeasurementSeries('pitchHz', 'speaker_0')).toHaveLength(3);
    expect(conversation.getChanges('speaker_0')).toHaveLength(2);
    expect(conversation.getChanges('speaker_0')[0].values.loudnessDb).toBeCloseTo(2.18, 1);
  });

  it('live: merges transcript_update into diarized turns like the demo', () => {
    const conversation = new Conversation();
    conversation.apply({
      type: 'directive',
      session_id: 's',
      speaker_id: 'speaker_0',
      timestamp_ms: 0,
      affect_available: false,
      acoustic_state: {
        values: { rms_dbfs: -20, f0_median_hz: 140, voiced_ratio: 0.9 },
        masks: { f0_available: true },
      },
      acoustic_change: null,
    });
    conversation.apply({
      type: 'transcript_update',
      session_id: 's',
      result_id: 'model:1',
      is_final: false,
      speech_final: false,
      provider: 'prosody_ssm',
      streaming: true,
      start_ms: 0,
      end_ms: 800,
      segments: [{
        start_ms: 0,
        end_ms: 800,
        speaker_id: 'speaker_0',
        text: 'Hello there',
        provider: 'prosody_ssm',
        result_id: 'model:1',
        is_final: false,
      }],
    });
    conversation.apply({
      type: 'transcript_update',
      session_id: 's',
      result_id: 'model:1',
      is_final: true,
      speech_final: true,
      provider: 'prosody_ssm',
      streaming: true,
      start_ms: 0,
      end_ms: 900,
      segments: [{
        start_ms: 0,
        end_ms: 900,
        speaker_id: 'speaker_0',
        text: 'Hello there friend',
        provider: 'prosody_ssm',
        result_id: 'model:1',
        is_final: true,
      }],
    });

    const turns = conversation.getTurns();
    expect(turns).toHaveLength(1);
    expect(turns[0].speaker_id).toBe('speaker_0');
    expect(turns[0].text).toBe('Hello there friend');
    expect(turns[0].prosody?.pitchHz).toBe(140);
    expect(conversation.getProsody()?.loudnessDbfs).toBe(-20);
  });

  it('live: speaker change starts a new turn', () => {
    const conversation = new Conversation();
    conversation.apply({
      type: 'transcript_update',
      session_id: 's',
      result_id: 'a',
      is_final: true,
      speech_final: true,
      provider: 'prosody_ssm',
      streaming: true,
      start_ms: 0,
      end_ms: 500,
      segments: [{
        start_ms: 0,
        end_ms: 500,
        speaker_id: 'speaker_0',
        text: 'Hi',
        provider: 'prosody_ssm',
        result_id: 'a',
        is_final: true,
      }],
    });
    conversation.apply({
      type: 'transcript_update',
      session_id: 's',
      result_id: 'b',
      is_final: true,
      speech_final: true,
      provider: 'prosody_ssm',
      streaming: true,
      start_ms: 600,
      end_ms: 1200,
      segments: [{
        start_ms: 600,
        end_ms: 1200,
        speaker_id: 'speaker_1',
        text: 'Hey',
        provider: 'prosody_ssm',
        result_id: 'b',
        is_final: true,
      }],
    });
    const turns = conversation.getTurns();
    expect(turns).toHaveLength(2);
    expect(turns.map((t) => t.speaker_id)).toEqual(['speaker_0', 'speaker_1']);
  });
});
