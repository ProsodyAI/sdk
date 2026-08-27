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
  it('batch: diarized turns + prosody state', () => {
    const conversation = Conversation.fromAnalysis(parseAnalysisResult(production));
    const turns = conversation.getTurns();
    expect(turns.length).toBeGreaterThan(0);
    expect(turns[0].speaker_id).toBeTruthy();
    expect(turns[0].text).toBeTruthy();
    expect(turns[0].prosody?.state.stress.loudness).toBeCloseTo(-18.04, 1);
    expect(conversation.getProsody()?.state.intonation.pitch).toBeCloseTo(
      conversation.getFrames().at(-1)?.state?.intonation.pitch ?? NaN,
      1,
    );
    expect(conversation.getSpeakers()).toEqual([{
      speaker_id: 'speaker_0',
      talk_ms: 90_000,
      turn_count: 1,
      window_count: 18,
    }]);
    expect(conversation.getMeasurementSeries('stress.loudness')).toHaveLength(3);
    expect(conversation.getMeasurementSeries('intonation.pitch', 'speaker_0')).toHaveLength(3);
    expect(conversation.getChanges('speaker_0')).toHaveLength(2);
    expect(conversation.getChanges('speaker_0')[0]!.values.stress.loudness).toBeCloseTo(2.18, 1);
  });

  it('live: merges transcript_update into diarized turns like the demo', () => {
    const conversation = new Conversation();
    conversation.apply({
      type: 'directive',
      session_id: 's',
      speaker_id: 'speaker_0',
      timestamp_ms: 0,
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
    expect(turns[0].prosody?.state.intonation.pitch).toBe(140);
    expect(conversation.getProsody()?.state.stress.loudness).toBe(-20);
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

  it('live: turn_boundary cuts the transcript into utterances', () => {
    const conversation = new Conversation();
    const words = [
      [0, 80, 'Anton'],
      [80, 160, 'Vanko'],
      [160, 240, 'was'],
      [240, 320, 'deported.'],
      [2000, 2080, 'However'],
      [2080, 2160, 'he was'],
      [2160, 2240, 'accused.'],
    ] as const;
    for (const [start_ms, end_ms, text] of words) {
      conversation.apply({
        type: 'transcript_update',
        session_id: 's',
        result_id: `model-${start_ms}`,
        is_final: true,
        speech_final: false,
        provider: 'prosody_ssm',
        streaming: true,
        start_ms,
        end_ms,
        segments: [{
          start_ms,
          end_ms,
          speaker_id: 'speaker_1',
          text,
          provider: 'prosody_ssm',
          is_final: true,
          result_id: `model-${start_ms}`,
        }],
      });
    }
    conversation.apply({ type: 'turn_boundary', frame_ms: 2000, commit_ms: 2080 });

    const turns = conversation.getTurns();
    expect(turns.map((turn) => turn.text)).toEqual([
      'Anton Vanko was deported.',
      'However he was accused.',
    ]);
    expect(turns.every((turn) => turn.speaker_id === 'speaker_1')).toBe(true);
  });

  it('live: jarvis transcript_update dump folds into the batch paragraph', () => {
    const conversation = new Conversation();
    const words = [
      'Anton', 'Vanko', 'was', 'the', 'Soviet', 'physicist', 'who', 'defected',
      'to the', 'United', 'States', 'in', 'nineteen', 'six', 'ty', 'three', '.',
      'However', ', he was', 'accu', 'sed', 'of', 'espionage', 'and was',
      'deported', 'in', 'nineteen', 'sixty', 'seven', '.',
      'His', 'son', 'Ivan,', 'who is', 'also', 'a', 'physicist', ',', 'was',
      'convicted', 'of', 'selling', 'Soviet', 'era', 'weapons', 'great',
      'pluto', 'nium to', 'Pakista', 'n', 'and', 'served', 'fifteen', 'years',
      'in', 'Kops', 'prison.',
    ];
    const periodAt = new Set([16, 29]);
    words.forEach((text, index) => {
      const start_ms = index * 80;
      conversation.apply({
        type: 'transcript_update',
        session_id: 's',
        result_id: `model-${start_ms}`,
        is_final: true,
        speech_final: false,
        provider: 'prosody_ssm',
        streaming: true,
        start_ms,
        end_ms: start_ms + 80,
        segments: [{
          start_ms,
          end_ms: start_ms + 80,
          speaker_id: 'speaker_1',
          text,
          provider: 'prosody_ssm',
          is_final: true,
          result_id: `model-${start_ms}`,
        }],
      });
      if (periodAt.has(index)) {
        conversation.apply({
          type: 'turn_boundary',
          frame_ms: start_ms + 80,
          commit_ms: start_ms + 80,
        });
      }
    });

    expect(conversation.getTurns().map((turn) => turn.text)).toEqual([
      'Anton Vanko was the Soviet physicist who defected to the United States in nineteen six ty three.',
      'However, he was accu sed of espionage and was deported in nineteen sixty seven.',
      'His son Ivan, who is also a physicist, was convicted of selling Soviet era weapons great pluto nium to Pakista n and served fifteen years in Kops prison.',
    ]);
    expect(conversation.getTranscript()).toBe(
      'Anton Vanko was the Soviet physicist who defected to the United States in nineteen six ty three. However, he was accu sed of espionage and was deported in nineteen sixty seven. His son Ivan, who is also a physicist, was convicted of selling Soviet era weapons great pluto nium to Pakista n and served fifteen years in Kops prison.',
    );
  });
});
