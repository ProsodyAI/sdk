/**
 * Live mic → WAV → base64 → Baseten predict (same contract as ProsodyClient with basetenPredictUrl).
 * Run from examples/: open live-baseten.html or use `npm run example` from package root.
 */

const DEFAULT_PREDICT_URL = 'https://model-31ddmz13.api.baseten.co/environments/production/predict';

const apiKeyEl = document.getElementById('apiKey');
const predictUrlEl = document.getElementById('predictUrl');
const durationEl = document.getElementById('duration');
const recordBtn = document.getElementById('recordBtn');
const resultEl = document.getElementById('result');

if (predictUrlEl) predictUrlEl.placeholder = DEFAULT_PREDICT_URL;

function setResult(text, isError = false) {
  if (!resultEl) return;
  resultEl.textContent = text;
  resultEl.className = isError ? 'error' : '';
}

function audioBufferToWav(buffer) {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const channel = buffer.getChannelData(0);
  const numSamples = channel.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);
  let offset = 0;

  function writeStr(s) {
    for (let i = 0; i < s.length; i++) view.setUint8(offset++, s.charCodeAt(i));
  }
  function write16(v) { view.setUint16(offset, v, true); offset += 2; }
  function write32(v) { view.setUint32(offset, v, true); offset += 4; }

  writeStr('RIFF');
  write32(dataSize + 36);
  writeStr('WAVE');
  writeStr('fmt ');
  write32(16);
  write16(1);
  write16(numChannels);
  write32(sampleRate);
  write32(sampleRate * blockAlign);
  write16(blockAlign);
  write16(16);
  writeStr('data');
  write32(dataSize);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, channel[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }
  return arrayBuffer;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function run() {
  const apiKey = apiKeyEl?.value?.trim();
  const predictUrl = (predictUrlEl?.value?.trim() || DEFAULT_PREDICT_URL).replace(/\/$/, '');
  const durationSec = Math.max(1, Math.min(10, Number(durationEl?.value) || 3));

  if (!apiKey) {
    setResult('Please enter your Baseten API key.', true);
    return;
  }

  recordBtn.disabled = true;
  recordBtn.classList.add('recording');
  setResult(`Recording for ${durationSec}s...`);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const chunks = [];

    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.start(100);

    await new Promise((r) => setTimeout(r, durationSec * 1000));
    recorder.stop();
    await new Promise((r) => { recorder.onstop = r; });
    stream.getTracks().forEach((t) => t.stop());

    setResult('Decoding audio...');
    const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const wav = audioBufferToWav(audioBuffer);
    const audioBase64 = arrayBufferToBase64(wav);

    setResult('Sending to Baseten...');
    const res = await fetch(predictUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Api-Key ${apiKey}`,
      },
      body: JSON.stringify({ audio_base64: audioBase64 }),
    });

    const data = await res.json();
    if (!res.ok) {
      setResult(`Error ${res.status}: ${JSON.stringify(data)}`, true);
      return;
    }
    if (data.error) {
      setResult('Error: ' + data.error, true);
      return;
    }
    const v = (n) => (typeof n === 'number' ? n.toFixed(3) : '—');
    setResult(
      `Emotion: ${data.emotion}\nConfidence: ${((data.confidence || 0) * 100).toFixed(1)}%\n` +
        `Valence: ${v(data.valence)}  Arousal: ${v(data.arousal)}  Dominance: ${v(data.dominance)}\n\n` +
        (data.emotion_probabilities ? 'Probabilities: ' + JSON.stringify(data.emotion_probabilities) : '')
    );
  } catch (err) {
    setResult('Error: ' + err.message, true);
  } finally {
    recordBtn.disabled = false;
    recordBtn.classList.remove('recording');
  }
}

recordBtn?.addEventListener('click', run);
