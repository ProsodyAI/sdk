# src

The `@prosodyai/sdk` source tree. Everything consumers touch is exported from
`index.ts`; everything between the wire and the consumer surface is typed.

- `types.ts` / `types/`: wire payloads, declared once. Wire field names live
  here and at the parse boundary.
- `conversation/prosody.ts`: the readable measurement layer. `Prosody`,
  `ProsodyChange`, `ProsodyDelta`, `MeasurementName`, and the wire-key maps
  that translate `acoustic_state` / `acoustic_change` into product names.
- `step.ts`: `AcousticWindow`, one measured interval with readable accessors.
- `analysis.ts`: `parseAnalysisResult` (batch envelope validation),
  `ConversationAnalysis`, `acousticWindows`, `measurementSeries`.
- `conversation.ts`: `Conversation`, the shared live/batch state model.
- `transcription.ts`: the transcribe product shape (`Speaker`, `VoiceProfile`,
  `Transcription`).
- `client.ts`, `session.ts`, `live-session.ts`, `realtime.ts`: transports.
- `__tests__/`: vitest suites; fixtures are captured production payloads.

Build with `npm run build` (dist is checked in). Test with `npm test`.
