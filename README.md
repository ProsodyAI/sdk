# @prosodyai/sdk

TypeScript client for ProsodyAI — batch analysis, realtime WebSocket streaming, and KPI feedback.

## Install

```bash
npm install @prosodyai/sdk
```

## Analyze a recording

```typescript
import { ProsodyClient } from '@prosodyai/sdk';

const client = new ProsodyClient({
  apiKey: process.env.PROSODY_API_KEY!, // psk_* from dashboard
});

const result = await client.analyze('./interview.wav');
// diarize defaults to true in the SDK
console.log(result.valence, result.arousal, result.dominance);
console.log(result.signals);
for (const turn of result.turns ?? []) {
  console.log(turn.speaker_id, turn.text, turn.prosody);
}
```

## Realtime streaming

```typescript
const stream = client.createRealtimeStream({
  sessionId: 'call-123',
  sampleRate: 16000,
  chunkDuration: 1,
  onResult: (r) => console.log(r.valence, r.signals, r.text),
  onError: console.error,
});

await stream.connect();
stream.send(pcmInt16);
await stream.end();
```

## Auth

- Header: `X-API-Key: psk_…` (batch)
- First WebSocket frame: `{ type: "config", api_key: "psk_…" }`
- Default origin: `https://api.prosodyai.app`

## Docs

[prosodyai.app/docs](https://prosodyai.app/docs) · [Quickstart](https://prosodyai.app/docs/quickstart)
