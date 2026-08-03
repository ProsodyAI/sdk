# @prosodyai/sdk

TypeScript SDK shaped like a transcription client: `transcribe(audio, { prosody })`
returns diarized turns with optional vocal measurement on each turn.

Live uses `listen(...)` (same socket as `realtime`). Persistent speaker identity
is a separate resource under `client.speakers`.

## Install

```bash
npm install github:ProsodyAI/sdk#main
```

You need a `psk_*` API key to use the client. Create one under **Organization →
API keys** in the [dashboard](https://prosodyai.app/login), then:

```bash
export PROSODY_API_KEY=psk_...
```

## Transports

| Path | What it is | Entry |
| --- | --- | --- |
| REST | Analyze a recording | `client.transcribe(audio, { prosody: true })` |
| Realtime WebSocket | You send PCM/Opus to `WS /v1/stream/realtime` | `client.realtime.session()` |
| LiveKit | WebRTC media; Prosody events on the room data topic | `client.livekit.createSession()` + `client.livekit.attach(room, …)` |

LiveKit is **not** a Prosody WebSocket. Browser media goes through LiveKit;
the analysis WebSocket is for workers (and the mic/file demo that pumps PCM
directly). The Python `livekit-plugins-prosodyai` package bridges a LiveKit
track into that WebSocket on the agent process.

## Transcribe a recording

```typescript
import { ProsodyClient } from '@prosodyai/sdk';

const client = new ProsodyClient({
  apiKey: process.env.PROSODY_API_KEY!,
});

const result = await client.transcribe('./call.wav', { prosody: true });

console.log(result.text);
console.log(result.speakers);

for (const turn of result.turns) {
  console.log(turn.speaker, turn.text, turn.prosody?.f0_median_hz);
}

const conversation = result.conversation;
console.log(conversation.getVocalFeatures());
console.log(conversation.getFeatureSeries('f0_median_hz', 'speaker_0'));
console.log(conversation.getDeltas('speaker_0'));
```

Diarization and `prosody` both default to true. Speakers are local to the recording.

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
