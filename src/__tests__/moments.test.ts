import { describe, expect, it } from 'vitest';
import { Conversation } from '../conversation.js';
import { transcriptionFromConversation } from '../transcription.js';
import type { AnalysisResult } from '../types.js';

/**
 * A batch report carrying committed conversation events. The magnitudes are
 * the model's own readout; the SDK only ranks them.
 */
function report(): AnalysisResult {
  return {
    prediction_id: 'pred-moments',
    session_id: 'call-moments',
    text: 'I have been on hold for an hour. Let me pull that up for you.',
    prosody: { valence: -0.2, arousal: 0.6, dominance: 0.5 },
    duration: 30,
    word_count: 14,
    turns: [
      {
        start_ms: 0,
        end_ms: 10_000,
        speaker_id: 'speaker_0',
        text: 'I have been on hold for an hour.',
        prosody: { valence: -0.6, arousal: 0.8, dominance: 0.4 },
      },
      {
        start_ms: 10_000,
        end_ms: 30_000,
        speaker_id: 'speaker_1',
        text: 'Let me pull that up for you.',
        prosody: { valence: 0.2, arousal: 0.3, dominance: 0.6 },
      },
    ],
    per_speaker: [
      { speaker_id: 'speaker_0', talk_ms: 10_000, window_count: 2, turn_count: 1 },
      { speaker_id: 'speaker_1', talk_ms: 30_000, window_count: 4, turn_count: 1 },
    ],
    events: [
      { type: 'turn_boundary', frame_ms: 9_920, commit_ms: 10_000 },
      {
        type: 'state_delta',
        frame_ms: 2_400,
        commit_ms: 2_800,
        duration_ms: 640,
        magnitude: 0.31,
        resolved: true,
      },
      {
        type: 'state_delta',
        frame_ms: 6_800,
        commit_ms: 7_200,
        duration_ms: 1_200,
        magnitude: 0.87,
        resolved: false,
      },
      {
        type: 'state_delta',
        frame_ms: 21_000,
        commit_ms: 21_400,
        duration_ms: 800,
        magnitude: 0.55,
        resolved: true,
      },
    ],
  };
}

describe('committed moments', () => {
  it('reads only state_delta events, in commit order', () => {
    const moments = Conversation.fromAnalysis(report()).getMoments();

    expect(moments.map((moment) => moment.magnitude)).toEqual([0.31, 0.87, 0.55]);
    expect(moments[0]).toEqual({
      frameMs: 2_400,
      commitMs: 2_800,
      durationMs: 640,
      magnitude: 0.31,
      resolved: true,
      speakerId: 'speaker_0',
    });
  });

  it('attributes a moment to the lane holding the floor at frame_ms', () => {
    const moments = Conversation.fromAnalysis(report()).getMoments();

    expect(moments.map((moment) => moment.speakerId)).toEqual([
      'speaker_0',
      'speaker_0',
      'speaker_1',
    ]);
  });

  it('ranks the shortlist by how far the state moved', () => {
    const top = Conversation.fromAnalysis(report()).getTopMoments(2);

    expect(top.map((moment) => moment.magnitude)).toEqual([0.87, 0.55]);
  });

  it('filters to one speaker', () => {
    const moments = Conversation.fromAnalysis(report()).getMoments('speaker_1');

    expect(moments).toHaveLength(1);
    expect(moments[0].magnitude).toBe(0.55);
  });

  it('carries no moments when the deployment committed none', () => {
    const withoutEvents = { ...report(), events: null };

    expect(Conversation.fromAnalysis(withoutEvents).getMoments()).toEqual([]);
  });

  it('carries no moments before the socket commits one', () => {
    expect(new Conversation().getMoments()).toEqual([]);
  });
});

/** One live transcript_update, enough to give the lane a span to attribute against. */
function liveTranscript(speakerId: string, startMs: number, endMs: number) {
  return {
    type: 'transcript_update' as const,
    session_id: 'live-1',
    provider: 'prosody_ssm',
    streaming: true,
    result_id: `${speakerId}-${startMs}`,
    start_ms: startMs,
    end_ms: endMs,
    is_final: true,
    speech_final: true,
    segments: [{
      start_ms: startMs,
      end_ms: endMs,
      speaker_id: speakerId,
      text: 'live words',
      provider: 'prosody_ssm',
      result_id: `${speakerId}-${startMs}`,
      is_final: true,
    }],
  };
}

function liveDelta(frameMs: number, magnitude: number) {
  return {
    type: 'state_delta' as const,
    session_id: 'live-1',
    frame_ms: frameMs,
    commit_ms: frameMs + 400,
    duration_ms: 640,
    magnitude,
    resolved: false,
  };
}

describe('live moments', () => {
  it('collects state_delta off the socket', () => {
    const conversation = new Conversation()
      .apply(liveTranscript('speaker_0', 0, 8_000))
      .apply(liveDelta(3_200, 0.44));

    const moments = conversation.getMoments();
    expect(moments).toHaveLength(1);
    expect(moments[0]).toEqual({
      frameMs: 3_200,
      commitMs: 3_600,
      durationMs: 640,
      magnitude: 0.44,
      resolved: false,
      speakerId: 'speaker_0',
    });
  });

  it('ranks live moments the same way batch does', () => {
    const conversation = new Conversation()
      .apply(liveTranscript('speaker_0', 0, 20_000))
      .apply(liveDelta(1_000, 0.2))
      .apply(liveDelta(5_000, 0.9))
      .apply(liveDelta(9_000, 0.5));

    expect(conversation.getTopMoments(2).map((m) => m.magnitude)).toEqual([0.9, 0.5]);
  });

  it('filters live moments by lane', () => {
    const conversation = new Conversation()
      .apply(liveTranscript('speaker_0', 0, 5_000))
      .apply(liveTranscript('speaker_1', 5_000, 10_000))
      .apply(liveDelta(2_000, 0.3))
      .apply(liveDelta(7_000, 0.6));

    expect(conversation.getMoments('speaker_1').map((m) => m.magnitude)).toEqual([0.6]);
  });

  it('leaves a moment unattributed when no committed turn covers it', () => {
    const conversation = new Conversation()
      .apply(liveTranscript('speaker_0', 0, 1_000))
      .apply(liveDelta(50_000, 0.7));

    expect(conversation.getMoments()[0].speakerId).toBeNull();
  });
});

describe('talk share', () => {
  it('is each speaker share of attributed speaking time', () => {
    const transcription = transcriptionFromConversation(
      Conversation.fromAnalysis(report()),
    );

    const shares = Object.fromEntries(
      transcription.speakers.map((speaker) => [speaker.id, speaker.talkShare]),
    );
    expect(shares.speaker_0).toBeCloseTo(0.25, 10);
    expect(shares.speaker_1).toBeCloseTo(0.75, 10);
  });

  it('sums to one across the call', () => {
    const transcription = transcriptionFromConversation(
      Conversation.fromAnalysis(report()),
    );

    const total = transcription.speakers.reduce(
      (sum, speaker) => sum + speaker.talkShare,
      0,
    );
    expect(total).toBeCloseTo(1, 10);
  });

  it('is zero for every speaker when nobody was attributed talk time', () => {
    const silent: AnalysisResult = {
      ...report(),
      per_speaker: [
        { speaker_id: 'speaker_0', talk_ms: 0, window_count: 0, turn_count: 0 },
      ],
      turns: [],
    };
    const transcription = transcriptionFromConversation(
      Conversation.fromAnalysis(silent),
    );

    expect(transcription.speakers.every((speaker) => speaker.talkShare === 0)).toBe(true);
  });

  it('surfaces the ranked shortlist on the transcription', () => {
    const transcription = transcriptionFromConversation(
      Conversation.fromAnalysis(report()),
    );

    expect(transcription.moments.map((moment) => moment.magnitude)).toEqual([
      0.87, 0.55, 0.31,
    ]);
  });
});
