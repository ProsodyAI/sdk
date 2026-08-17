/** Real SDK run for local debugging. Paths relative to repo root. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ProsodyClient, Conversation } from '../dist/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const API_KEY = process.env.PROSODYAI_API_KEY || '';
const BASE_URL = process.env.PROSODYAI_API_URL || 'http://localhost:8791';
const AUDIO = process.env.PROSODYAI_AUDIO || join(ROOT, 'diarization_check/output/clip.wav');
const OUT = process.env.PROSODYAI_OUT || join(ROOT, 'tmp-sdk-run.txt');

const lines = [];
const say = (s) => { console.log(s); lines.push(String(s)); };

const client = new ProsodyClient({ apiKey: API_KEY, baseUrl: BASE_URL, timeoutMs: 600000 });
const wav = readFileSync(AUDIO);
say(`audio: ${AUDIO} (${wav.length} bytes) -> ${BASE_URL}`);

const t0 = Date.now();
const raw = await client.analyze(wav, { diarize: true });
say(`analyze took ${((Date.now() - t0) / 1000).toFixed(1)}s`);

say('\n=== server stage timings (mean ms/frame) ===');
say(JSON.stringify(raw.timings_ms ?? raw.timings ?? '(none on wire)', null, 1));

const analysis = Conversation.fromAnalysis(raw);

say('\n=== transcript ===');
say(analysis.getTranscript() || '(empty)');

say('\n=== speakers ===');
for (const s of analysis.getSpeakers()) {
  say(`${s.speaker_id}: ${(s.talk_ms / 1000).toFixed(1)}s talk, ${s.turn_count} turns, ${s.window_count} windows`);
}

say('\n=== turns ===');
for (const turn of analysis.getTurns()) {
  say(`[${(turn.start_ms / 1000).toFixed(1)}-${(turn.end_ms / 1000).toFixed(1)}s] ${turn.speaker_id}: ${turn.text}`);
}

const frames = analysis.getFrames();
say(`\n=== frames: ${frames.length} measured windows ===`);

for (const path of ['intonation.pitch', 'intonation.range', 'intonation.slope', 'stress.loudness', 'stress.peak', 'rhythm.voiced', 'rhythm.onset', 'tilt']) {
  const series = analysis.getMeasurementSeries(path);
  const finite = series.map((p) => p.value).filter((v) => Number.isFinite(v));
  if (!finite.length) { say(`${path}: no measured windows`); continue; }
  const mean = finite.reduce((a, b) => a + b, 0) / finite.length;
  say(`${path}: n=${finite.length} mean=${mean.toFixed(3)} min=${Math.min(...finite).toFixed(3)} max=${Math.max(...finite).toFixed(3)}`);
}

say('\n=== affect (V/A/D, whole file) ===');
say(JSON.stringify(analysis.getVad()));

say('\n=== latest window prosody ===');
say(JSON.stringify(analysis.getProsody()));

writeFileSync(OUT, lines.join('\n') + '\n');
console.log(`wrote ${OUT}`);
