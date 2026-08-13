# @prosodyai/sdk

TypeScript client for recorded transcription, realtime acoustic analysis, and
LiveKit event delivery.

## Installation

```bash
npm install @prosodyai/sdk
```

```bash
export PROSODY_API_KEY=psk_...
```

Create organization keys at [prosodyai.app](https://prosodyai.app/login).

## Recorded audio

```typescript
import { ProsodyClient } from '@prosodyai/sdk';

const prosody = new ProsodyClient({
  apiKey: process.env.PROSODY_API_KEY!,
});

const result = await prosody.transcribe('./call.wav');

for (const turn of result.turns) {
  console.log({
    speakerId: turn.speaker.id,
    speaker: turn.speaker.label,
    startMs: turn.startMs,
    endMs: turn.endMs,
    text: turn.text,
    pitchHz: turn.prosody?.pitchHz,
    loudnessDbfs: turn.prosody?.loudnessDbfs,
    loudnessChangeDb: turn.prosody?.change?.loudnessDb,
  });
}
```

`transcribe` accepts a local path, an HTTPS URL, or a Node.js `Buffer`.
Diarization and prosody measurement are enabled by default.

## Speaker

```typescript
const [speaker] = result.speakers;

speaker.id;                          // stable within this call
speaker.label;                       // display label ("Speaker 1")
speaker.talkSeconds;
speaker.voice.pitchHz?.median;
speaker.voice.loudnessDbfs?.median;

result.getSpeaker(speaker.id);
result.turnsBySpeaker(speaker);
```

`speaker.id` is recording-local. Durable cross-session identity is a separate
resource — see [Speaker directory](#speaker-directory-and-enrollment).

## Realtime WebSocket

```typescript
const session = prosody.realtime.session({
  encoding: 'pcm16',
  sampleRate: 16_000,
  onUpdate: (current) => render(current.snapshot()),
});

await session.start();
session.send(pcmChunk);
await session.stop();
```

Use `waitForFrame()` to pace file replay:

```typescript
for (const chunk of chunks) {
  session.send(chunk);
  await session.waitForFrame();
}
```

## LiveKit

```typescript
// Trusted server
const credentials = await prosody.livekit.createSession({
  participantName: 'caller',
});

// Browser, after Room.connect(...)
const session = prosody.livekit.attach(room, {
  sessionId: credentials.session_id,
  onAcousticWindow: (window) => render(window),
});
```

LiveKit carries WebRTC media. Analysis events arrive on `prosody.events.v1`.

## Low-level conversation data

`result.conversation` exposes ordered acoustic windows, trajectories, and
speaker-relative deltas:

```typescript
const windows = result.conversation.getAcoustics(speaker.id);
const pitch = result.conversation.getMeasurementSeries(
  'pitchHz',
  speaker.id,
);
const changes = result.conversation.getChanges(speaker.id);
```

## Speaker directory and enrollment

```typescript
const directory = await prosody.speakers.list();
const preview = await prosody.speakers.previewEnrollment('./enroll.wav');

await prosody.speakers.confirmEnrollment(
  './enroll.wav',
  preview.preview_sha256,
  preview.lanes.map((lane) => ({
    speaker_id: lane.speaker_id,
    display_name: nameFor(lane),
  })),
);
```

Enrollment uses a preview-confirm transaction. Preview returns the detected
lanes; confirm persists the supplied mappings. This is where durable,
cross-session `person_id` identity comes from — distinct from the
recording-local `speaker.id` on a `Transcription`.

## Documentation

- [Quickstart](https://prosodyai.app/docs/quickstart)
- [ProsodyClient](https://prosodyai.app/docs/reference)
- [Speaker](https://prosodyai.app/docs/reference/speaker)
- [Prosody](https://prosodyai.app/docs/reference/prosody)
- [LiveSession](https://prosodyai.app/docs/reference/live-session)
