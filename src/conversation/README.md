# src/conversation

Turn assembly and the readable measurement layer behind `Conversation`.

- `prosody.ts`: `Prosody`, `ProsodyChange`, `ProsodyDelta`, `MeasurementName`,
  and the wire-key maps (`MEASUREMENT_WIRE`, `CHANGE_WIRE`). The only module
  that translates wire acoustic payloads into product names.
- `turn-model.ts`: `ConversationTurn`, `LiveSegment`, `StepAnchor`, speaker-id
  helpers.
- `turn-builder.ts`: merges transcript segments into speaker-owned turns and
  attaches the overlap-weighted `Prosody` measurement.
- `transcript-merge.ts`: segment merge and speaker-update reducers.
- `speaker-resolution.ts`: assigns live segments to committed speaker lanes.
