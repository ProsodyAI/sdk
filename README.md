# @prosodyai/sdk

TypeScript SDK for turning recorded speech into a **`Conversation`**: diarized
transcript turns, vocal acoustics over time, and speaker-relative change.

Persistent speaker identity is a separate API surface. Conversation speakers
are local to one recording. `prosody.speakers` provides durable identity only
when the API key has access to that capability.

## Install

The npm package is not published yet. Install the current public SDK from
GitHub:

```bash
npm install github:ProsodyAI/sdk#main
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
console.log(conversation.getSpeakers());

for (const turn of conversation.getTurns()) {
  console.log(turn.speaker_id, turn.text, turn.vocal?.f0_median_hz);
}

console.log(conversation.getVocalFeatures()); // latest window
console.log(conversation.getFeatureSeries('f0_median_hz', 'speaker_0'));
console.log(conversation.getDeltas('speaker_0'));
```

Diarization is on by default. `speaker_id` is local to the recording.

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

## Persistent speaker identity

```typescript
const directory = await prosody.speakers.list();
const preview = await prosody.speakers.previewEnrollment('./enroll.wav');
await prosody.speakers.confirmEnrollment(
  './enroll.wav',
  preview.preview_sha256,
  preview.clusters.map((cluster) => ({
    speaker_id: cluster.speaker_id,
    display_name: nameFor(cluster),
  })),
);
```

The API key controls data scope and whether persistent identity is available.
Raw speaker-profile vectors are not returned.

## Raw API response

```typescript
const result = await prosody.analyze('./call.wav', { diarize: true });
```

Default origin: `https://api.prosodyai.app`. Auth header: `X-API-Key`.
