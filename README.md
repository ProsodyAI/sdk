# @prosodyai/sdk

TypeScript client for ProsodyAI batch analysis and LiveKit room events.

## Install

```bash
npm install @prosodyai/sdk
```

The package is public. Bring your own compatible `livekit-client` version when
receiving live session events.

## Batch analysis

```typescript
import { ProsodyClient } from '@prosodyai/sdk';

const client = new ProsodyClient({
  apiKey: process.env.PROSODYAI_API_KEY!,
});

const result = await client.analyze('./interview.wav');
console.log(result.prosody.valence, result.prosody.arousal);
console.log(result.prosody_summary, result.sequence_signals);
for (const turn of result.turns ?? []) {
  console.log(turn.speaker_id, turn.text, turn.prosody);
}
```

`AnalysisResult` mirrors `POST /v1/analyze/audio`, including
`prosody_summary`, `per_speaker`, `sequence_signals`, `call_insights`, and
`timings_ms`.

## LiveKit room sessions

ProsodyAI analyzes room audio through its LiveKit participant/sidecar. The SDK
does not open a second audio WebSocket. It listens for reliable data packets on
the `prosodyai.events` topic.

```typescript
import { Room } from 'livekit-client';
import { ProsodySession } from '@prosodyai/sdk';

const room = new Room();
await room.connect(livekitUrl, participantToken);

const prosody = new ProsodySession(room, {
  sessionId: 'call-123', // shared with the ProsodyAI room participant
  onDirective: (event) => {
    console.log(event.prosody, event.agent_modulation);
  },
  onTranscriptUpdate: (event) => {
    // Replace the previous interim segments with the same result_id.
    console.log(event.result_id, event.is_final, event.segments);
  },
  onSteering: (event) => {
    agent.updateInstructions(event.system_prompt);
  },
  onSessionEnd: (event) => {
    console.log(event.call_insights, event.per_speaker);
  },
  onError: console.error,
}).start();

// Detach the data listener when the room/session UI is disposed.
prosody.stop();
```

Every event uses the ordered envelope:

```json
{
  "session_id": "call-123",
  "generation": 1,
  "seq": 42,
  "type": "directive"
}
```

`ProsodySession` ignores duplicate/out-of-order sequence numbers and stale
generations. A higher generation starts a new sequence for the same session.
The event union includes `directive`, `transcript_update`, `agent_steering`,
`insights_update`, `session_end`, `warning`, and `error`.

## Authentication

- Batch REST uses `X-API-Key` from `ProsodyClient`.
- LiveKit room authentication and ProsodyAI participant dispatch are configured
  by your server; API keys should not be sent through room data packets.
- The default REST origin is `https://api.prosodyai.app`.

## Docs

[prosodyai.app/docs](https://prosodyai.app/docs) · [Quickstart](https://prosodyai.app/docs/quickstart)
