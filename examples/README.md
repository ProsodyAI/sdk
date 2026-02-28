# Examples

## Live Baseten test

Record from your microphone and send audio to the Baseten ProsodySSM predict endpoint (same request shape as the SDK with `basetenPredictUrl`).

**Run the page**

From the SDK package root:

```bash
npm run example
```

Then open **http://localhost:3000/examples/live-baseten.html** in your browser.

**Configure**

- **Baseten API key** – from [Baseten → API keys](https://app.baseten.co/settings/account/api_keys).
- **Predict URL** – optional; defaults to `https://model-31ddmz13.api.baseten.co/environments/production/predict`.
- **Record duration** – 1–10 seconds.

Click **Record and send**; the page will show emotion, confidence, valence, arousal, and dominance.
