import { describe, expect, it, vi } from 'vitest';
import {
  PROSODY_EVENT_TOPIC,
  ProsodySession,
  parseProsodyEvent,
} from '../session.js';
import type {
  LiveKitDataReceivedHandler,
  LiveKitRoomLike,
} from '../session.js';

class MockRoom implements LiveKitRoomLike {
  private listeners = new Set<LiveKitDataReceivedHandler>();

  on(_event: 'dataReceived', listener: LiveKitDataReceivedHandler): this {
    this.listeners.add(listener);
    return this;
  }

  off(_event: 'dataReceived', listener: LiveKitDataReceivedHandler): this {
    this.listeners.delete(listener);
    return this;
  }

  emit(value: unknown, topic = PROSODY_EVENT_TOPIC, identity = 'prosody-sidecar'): void {
    const payload = new TextEncoder().encode(JSON.stringify(value));
    for (const listener of this.listeners) {
      listener(payload, { identity }, undefined, topic);
    }
  }
}

describe('parseProsodyEvent', () => {
  it('preserves the current directive contract', () => {
    const event = parseProsodyEvent({
      session_id: 'call-123',
      generation: 4,
      seq: 12,
      type: 'directive',
      prosody: { valence: -0.2, arousal: 0.8, dominance: 0.6 },
      affect_available: false,
      valence: -0.2,
      arousal: 0.8,
      dominance: 0.6,
      acoustic_state: {
        values: { rms_dbfs: -32.5, f0_median_hz: 180.0, voiced_ratio: 0.6 },
        masks: { f0_available: true },
      },
      acoustic_change: null,
      timings_ms: { mimi_encode: 9.1, prosody_inference: 4.3, chunk_total: 22.4 },
      text: 'I have already called twice.',
      frames_processed: 8,
      timestamp_ms: 8_000,
      speaker_id: 'caller',
      is_overlap: false,
      speaker_changed: true,
      speech_ratio: 0.93,
      speaker_activity_available: true,
      num_speakers: 2,
      diar_segments: [],
      phonemes: [],
      ipa_transcript: '',
      prosody_embedding: null,
      forward_prediction: null,
      agent_modulation: {
        mode: 'caller_escalating',
        intensity: 0.81,
        tts: {
          speed: 0.84,
          pitch_shift_semitones: -1.6,
          emotion: 'warm',
          target_intensity: 0.26,
          pre_pause_ms: 312,
        },
        system_prompt_fragment: 'Acknowledge feelings before substance.',
        should_yield: false,
        recommended_tone: 'empathetic',
      },
      modulation_mode: 'caller_escalating',
      is_escalating: true,
      is_interrupting: false,
      should_yield: false,
      is_steering: true,
      tts_speed: 0.9,
    });

    expect(event.type).toBe('directive');
    if (event.type !== 'directive') throw new Error('unexpected event');
    expect(event.agent_modulation?.mode).toBe('caller_escalating');
    expect(event.timings_ms.chunk_total).toBe(22.4);
    expect(event.acoustic_state?.values?.rms_dbfs).toBe(-32.5);
    expect(event.affect_available).toBe(false);
  });

  it('accepts the current wire envelope without generation or sequence', () => {
    const event = parseProsodyEvent({
      session_id: 'call-123',
      type: 'directive',
    });
    expect(event.session_id).toBe('call-123');
  });
});

describe('ProsodySession', () => {
  it('delivers diarizer updates and cluster merges', () => {
    const room = new MockRoom();
    const onSpeakerUpdate = vi.fn();
    const onSpeakerClusterUpdate = vi.fn();
    new ProsodySession(room, {
      sessionId: 'call-123',
      onSpeakerUpdate,
      onSpeakerClusterUpdate,
    }).start();

    room.emit({
      session_id: 'call-123',
      generation: 1,
      seq: 1,
      type: 'speaker_update',
      start_ms: 0,
      end_ms: 1000,
      speaker_id: 'speaker_1',
      speaker_changed: true,
      is_overlap: false,
      num_speakers: 2,
      speech_ratio: 0.92,
      diarizer_confidence: 0.88,
      is_agent: false,
      speaker_merges: [],
      merge_conflicts: [],
    });
    room.emit({
      session_id: 'call-123',
      generation: 1,
      seq: 2,
      type: 'speaker_cluster_update',
      speaker_merges: [{
        source_speaker_id: 'speaker_2',
        target_speaker_id: 'speaker_1',
        similarity: 0.94,
      }],
      merge_conflicts: [],
    });

    expect(onSpeakerUpdate).toHaveBeenCalledOnce();
    expect(onSpeakerUpdate.mock.calls[0][0]).toMatchObject({
      speaker_id: 'speaker_1',
      diarizer_confidence: 0.88,
    });
    expect(onSpeakerClusterUpdate).toHaveBeenCalledOnce();
    expect(onSpeakerClusterUpdate.mock.calls[0][0].speaker_merges[0]).toMatchObject({
      source_speaker_id: 'speaker_2',
      target_speaker_id: 'speaker_1',
    });
  });

  it('delivers durable speaker identity updates', () => {
    const room = new MockRoom();
    const onSpeakerProfiles = vi.fn();
    new ProsodySession(room, { sessionId: 'call-123', onSpeakerProfiles }).start();

    room.emit({
      session_id: 'call-123',
      generation: 1,
      seq: 1,
      type: 'speaker_profiles',
      timestamp_ms: 4_000,
      profiles: [{
        speaker_id: 'speaker_0',
        talk_ms: 4_000,
        window_count: 4,
        turn_count: 2,
        confidence: 0.96,
        identity: {
          person_id: 'person:jacob',
          display_name: 'Jacob',
          is_returning: true,
          person_match_sim: 0.93,
        },
      }],
    });

    expect(onSpeakerProfiles).toHaveBeenCalledOnce();
    expect(onSpeakerProfiles.mock.calls[0][0].profiles[0].identity).toMatchObject({
      person_id: 'person:jacob',
      is_returning: true,
    });
  });

  it('delivers transcript replacements and steering callbacks in sequence', () => {
    const room = new MockRoom();
    const onTranscriptUpdate = vi.fn();
    const onSteering = vi.fn();
    const onEvent = vi.fn();
    const session = new ProsodySession(room, {
      sessionId: 'call-123',
      participantIdentity: 'prosody-sidecar',
      onTranscriptUpdate,
      onSteering,
      onEvent,
    }).start();

    const interim = transcriptUpdate(1, false, 'I have already');
    const final = transcriptUpdate(2, true, 'I have already called twice.');
    room.emit(interim);
    room.emit(final);
    room.emit(final);
    room.emit({
      session_id: 'call-123',
      generation: 1,
      seq: 3,
      type: 'agent_steering',
      previous_mode: 'normal',
      mode: 'caller_escalating',
      intensity: 0.81,
      reason: 'stress=0.72 sustained 2 chunks',
      tts: {
        speed: 0.84,
        pitch_shift_semitones: -1.6,
        emotion: 'warm',
        target_intensity: 0.26,
        pre_pause_ms: 312,
      },
      system_prompt: 'Acknowledge the caller before addressing the issue.',
      should_yield: false,
      timestamp_ms: 8_000,
      recommended_tone: 'empathetic',
    });

    expect(onTranscriptUpdate).toHaveBeenCalledTimes(2);
    expect(onTranscriptUpdate.mock.calls[0][0]).toMatchObject({
      result_id: 'deepgram:0:2500',
      is_final: false,
      speech_final: false,
    });
    expect(onTranscriptUpdate.mock.calls[1][0].segments[0]).toMatchObject({
      result_id: 'deepgram:0:2500',
      is_final: true,
      text: 'I have already called twice.',
    });
    expect(onSteering).toHaveBeenCalledOnce();
    expect(onEvent).toHaveBeenCalledTimes(3);
    expect(session.generation).toBe(1);
    expect(session.lastSeq).toBe(3);
  });

  it('accepts a new generation and ignores stale generations, sessions, and topics', () => {
    const room = new MockRoom();
    const onTranscriptUpdate = vi.fn();
    const session = new ProsodySession(room, {
      sessionId: 'call-123',
      onTranscriptUpdate,
    }).start();

    room.emit(transcriptUpdate(7, true, 'generation one'));
    room.emit({ ...transcriptUpdate(0, true, 'generation two'), generation: 2 });
    room.emit({ ...transcriptUpdate(99, true, 'stale'), generation: 1 });
    room.emit({ ...transcriptUpdate(1, true, 'other'), session_id: 'other-call' });
    room.emit(transcriptUpdate(2, true, 'other topic'), 'other.topic');

    expect(onTranscriptUpdate).toHaveBeenCalledTimes(2);
    expect(onTranscriptUpdate.mock.calls[1][0].segments[0].text).toBe('generation two');
    expect(session.generation).toBe(2);
    expect(session.lastSeq).toBe(0);
  });

  it('surfaces the complete session_end payload', () => {
    const room = new MockRoom();
    const onSessionEnd = vi.fn();
    new ProsodySession(room, { sessionId: 'call-123', onSessionEnd }).start();

    room.emit({
      session_id: 'call-123',
      generation: 1,
      seq: 20,
      type: 'session_end',
      frames_processed: 20,
      transcript: {
        session_id: 'call-123',
        duration_seconds: 20,
        turns: [],
        segments: [],
        steering_events: [],
        prosody_timeline: [],
        per_speaker: [],
        sequence_signals: { interruption_risk: 0.88 },
        call_insights: [],
        alerts: [],
        recommended_actions: [],
      },
      call_insights: [{
        title: 'Interruption pressure',
        detail: 'Sequence interruption_risk=0.88',
        at_ms: 8_000,
      }],
      sequence_signals: { interruption_risk: 0.88 },
      alerts: [],
      recommended_actions: [],
      prosody_timeline: [],
      per_speaker: [{
        speaker_id: 'caller',
        talk_ms: 12_000,
        window_count: 12,
        valence: -0.2,
        arousal: 0.7,
        dominance: 0.6,
        signals: { stress: 0.72 },
      }],
      diagnostic: {
        bytes_received: 640_000,
        chunks_received: 20,
        chunks_all_zero: 0,
        chunks_gated_silent: 1,
        samples_nonzero: 200_000,
        frames_processed: 20,
        audio_silent: false,
        input_sample_rate: 16_000,
        input_encoding: 'pcm16',
      },
    });

    expect(onSessionEnd).toHaveBeenCalledOnce();
    expect(onSessionEnd.mock.calls[0][0].call_insights[0].title).toBe(
      'Interruption pressure',
    );
    expect(onSessionEnd.mock.calls[0][0].per_speaker[0].speaker_id).toBe('caller');
  });
});

function transcriptUpdate(seq: number, isFinal: boolean, text: string) {
  return {
    session_id: 'call-123',
    generation: 1,
    seq,
    type: 'transcript_update',
    provider: 'deepgram',
    streaming: true,
    result_id: 'deepgram:0:2500',
    start_ms: 2_500,
    end_ms: 3_700,
    is_final: isFinal,
    speech_final: isFinal,
    segments: [{
      start_ms: 2_500,
      end_ms: 3_700,
      speaker_id: 'deepgram_0',
      text,
      provider: 'deepgram',
      result_id: 'deepgram:0:2500',
      is_final: isFinal,
    }],
  };
}
