# @prosodyai/sdk

TypeScript SDK for ProsodyAI. The product object for integrators is
**`Conversation`**: diarized transcript turns plus gated vocal features, live
and batch.

## Install

```bash
npm install @prosodyai/sdk
```

## Analyze a recording

Every request requires a `psk_*` API key.

```typescript
import { ProsodyClient } from '@prosodyai/sdk';

const prosody = new ProsodyClient({
  apiKey: process.env.PROSODY_API_KEY!,
});

const conversation = await prosody.conversations.analyze('./call.wav');

console.log(conversation.getTranscript());

for (const turn of conversation.getTurns()) {
  console.log(turn.speaker_id, turn.text, turn.vocal?.f0_median_hz);
}

console.log(conversation.getVocalFeatures()); // latest window
console.log(conversation.getSpeakerProfile('speaker_0')?.identity?.person_id);
```

Diarization is on by default. `speaker_id` is local to the recording;
`person_id` comes from the organization speaker directory when known.

## Live conversation

Feed wire events into the same object:

```typescript
import { Conversation, ProsodyRealtimeStream } from '@prosodyai/sdk';

const conversation = new Conversation();
const stream = new ProsodyRealtimeStream(
  { apiKey: process.env.PROSODY_API_KEY! },
  { conversation },
);
await stream.connect();
// stream.sendAudio(pcm16Chunk)
// conversation.getTurns() / getVocalFeatures() update as events arrive
```

LiveKit rooms use `ProsodySession` the same way — pass `{ conversation }`.

## Acoustic windows

```typescript
for (const window of conversation.getAcoustics()) {
  console.log({
    speaker: window.getSpeakerId(),
    level: window.getFeature('rms_dbfs'),
    pitch: window.getFeature('f0_median_hz'),
    voicing: window.getFeature('voiced_ratio'),
    levelDelta: window.getDelta('rms_db_change'),
  });
}
```

Measurements come from gated heads over Mimi latents. Pitch fields are `null`
when the window is unvoiced. Raw latents, recurrent state, and voiceprint
vectors are not returned.

## Organization speaker identity

```typescript
const directory = await prosody.organization.speakers.list();
const preview = await prosody.organization.speakers.previewEnrollment('./enroll.wav');
await prosody.organization.speakers.confirmEnrollment(
  './enroll.wav',
  preview.preview_sha256,
  preview.clusters.map((cluster) => ({
    speaker_id: cluster.speaker_id,
    display_name: nameFor(cluster),
  })),
);
```

## Raw API response

```typescript
const result = await prosody.analyze('./call.wav', { diarize: true });
```

Default origin: `https://api.prosodyai.app`. Auth header: `X-API-Key`.
