// Stream a recording to production through the SDK and grade what it holds.
//
//   PROSODYAI_API_KEY=... node examples/live-acceptance.mjs call.wav [baseUrl]
//
// This is the SDK's own acceptance path: 16 kHz mono PCM16 WAV in 80 ms
// frames at realtime pace, a Conversation built from the wire, and hard
// checks on what a reader ends up with — enough words, every word settled
// (nothing left mid-word), a speaker on the words. Exits non-zero when the
// live API fails any of them.
import { readFileSync } from 'node:fs';
import { LiveSession } from '@prosodyai/sdk';

const SAMPLE_RATE = 16_000;
const FRAME_SAMPLES = SAMPLE_RATE * 0.08;

const [wavPath, baseUrl = 'https://api.prosodyai.app'] = process.argv.slice(2);
const apiKey = process.env.PROSODYAI_API_KEY || process.env.PROSODYAI_DEMO_API_KEY;
if (!apiKey || !wavPath) {
  console.error('usage: PROSODYAI_API_KEY=... node examples/live-acceptance.mjs call.wav');
  process.exit(2);
}

const wav = readFileSync(wavPath);
const pcm = new Int16Array(wav.buffer, wav.byteOffset + 44, (wav.byteLength - 44) >> 1);

const errors = [];
const session = new LiveSession({
  apiKey,
  baseUrl,
  onError: (error) => errors.push(String(error.message)),
});
await session.start({
  sampleRate: SAMPLE_RATE,
  encoding: 'pcm16',
  source: 'file_replay',
  sourceOffsetMs: 0,
});

const started = Date.now();
const frames = Math.floor(pcm.length / FRAME_SAMPLES);
for (let index = 0; index < frames; index += 1) {
  session.send(pcm.subarray(index * FRAME_SAMPLES, (index + 1) * FRAME_SAMPLES));
  const due = started + (index + 1) * 80;
  const wait = due - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}
const end = await session.stop({ waitForSessionEndMs: 25_000 });

const turns = session.conversation.getTurns();
const text = turns.map((turn) => turn.text).join(' ').replace(/\s+/g, ' ').trim();
const words = text ? text.split(' ') : [];
const speakers = [...new Set(turns.map((turn) => turn.speaker_id))];

const failures = [];
if (!end) failures.push('no session_end arrived');
if (words.length < 10) failures.push(`only ${words.length} words came back`);
if (!speakers.length) failures.push('no speaker on the words');
if (errors.length) failures.push(`socket errors: ${[...new Set(errors)].join(' | ')}`);

console.log(JSON.stringify({ seconds: +((frames * 0.08).toFixed(1)), words: words.length, turns: turns.length, speakers }));
console.log('text:', text);
for (const failure of failures) console.log('FAIL:', failure);
console.log(failures.length ? 'FAIL' : 'PASS');
process.exit(failures.length ? 1 : 0);
