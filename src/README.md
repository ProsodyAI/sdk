# src

The `@prosodyai/sdk` source tree. Everything consumers touch is exported from
`index.ts`; everything between the wire and the consumer surface is typed.

- `types.ts` / `types/`: wire payloads, declared once. Wire field names live
  here and at the parse boundary.
- `conversation/prosody.ts`: the readable measurement layer. `Prosody`,
  `ProsodyState`, `ProsodyChange`, `ProsodyDelta`, `MeasurementPath`, and the
  wire-key maps that translate `acoustic_state` / `acoustic_change` into
  family-shaped product names.
- `step.ts`: `VoiceFrame`, one measured interval, exposing `state`, `change`,
  and `vad` directly.
- `analysis.ts`: `parseAnalysisResult` (batch envelope validation),
  `ConversationAnalysis`, `voiceFrames`, `measurementSeries`.
- `conversation.ts`: `Conversation`, the shared live/batch state model.
- `transcription.ts`: the transcribe product shape (`Speaker`, `VoiceProfile`,
  `Transcription`).
- `client.ts`, `session.ts`, `live-session.ts`, `realtime.ts`: transports.
- `__tests__/`: vitest suites; fixtures are captured production payloads.

Build with `npm run build` (dist is checked in). Test with `npm test`.
