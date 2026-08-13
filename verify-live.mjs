/**
 * Live smoke: run one audio file through a real API and print what the
 * one-call readouts return. Mints and revokes an ephemeral tenant key when
 * PROSODYAI_ADMIN_API_KEY is set (repo-root .env), else uses PROSODY_API_KEY.
 *
 * Usage:
 *   node verify-live.mjs path/to/audio.wav [--base http://localhost:8080]
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ProsodyClient } from './dist/index.js';

const args = process.argv.slice(2);
const audioPath = args.find((a) => !a.startsWith('--'));
const baseIdx = args.indexOf('--base');
const baseUrl = (baseIdx >= 0 ? args[baseIdx + 1] : process.env.PROSODYAI_API_URL) || 'https://api.prosodyai.app';
const orgSlug = process.env.PROSODY_ORG || 'prosodyai';

// Fill unset vars from the repo-root .env
try {
  const envPath = resolve(import.meta.dirname, '../../.env');
  for (const line of readFileSync(envPath, 'utf8').splitlines()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    if (key && !process.env[key]?.trim()) {
      process.env[key] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
} catch { /* no repo .env */ }

if (!audioPath) {
  console.error('usage: node verify-live.mjs <audio-file> [--base URL]');
  process.exit(2);
}

async function mintEphemeralKey() {
  const adminKey = process.env.PROSODYAI_ADMIN_API_KEY?.trim();
  if (!adminKey) return null;
  const tenantsResp = await fetch(`${baseUrl}/v1/admin/tenants`, { headers: { 'X-Admin-Key': adminKey } });
  if (!tenantsResp.ok) throw new Error(`admin list tenants failed: ${tenantsResp.status}`);
  const org = (await tenantsResp.json()).find((t) => t.slug === orgSlug);
  if (!org) throw new Error(`no org with slug=${orgSlug}`);
  const keyResp = await fetch(`${baseUrl}/v1/admin/tenants/${org.id}/api-keys?name=sdk-verify-live`, {
    method: 'POST',
    headers: { 'X-Admin-Key': adminKey },
  });
  if (!keyResp.ok) throw new Error(`admin create api-key failed: ${keyResp.status}`);
  const body = await keyResp.json();
  return { orgId: org.id, keyId: body.id, key: body.key, adminKey };
}

async function revokeEphemeralKey(minted) {
  await fetch(`${baseUrl}/v1/admin/tenants/${minted.orgId}/api-keys/${minted.keyId}`, {
    method: 'DELETE',
    headers: { 'X-Admin-Key': minted.adminKey },
  }).catch(() => {});
}

const minted = process.env.PROSODY_API_KEY?.trim() ? null : await mintEphemeralKey();
const apiKey = process.env.PROSODY_API_KEY?.trim() || minted?.key;
if (!apiKey) {
  console.error('no auth: set PROSODY_API_KEY or PROSODYAI_ADMIN_API_KEY');
  process.exit(2);
}

const audio = readFileSync(audioPath);
const client = new ProsodyClient({ apiKey, baseUrl, timeoutMs: 600000 });

try {
  console.log(`analyze ${audioPath} via ${baseUrl}`);

  // Sequential: a single-replica deployment must not see four scans at once.
  const turns = await client.getTurns(audio);
  const boundaries = await client.getTurnBoundaries(audio);
  const events = await client.getEvents(audio);
  const speakers = await client.getSpeakers(audio);

  console.log(`\n--- getTurns (${turns.length}) ---`);
  for (const turn of turns) {
    console.log(`[${(turn.start_ms / 1000).toFixed(2)}-${(turn.end_ms / 1000).toFixed(2)}] ${turn.speaker_id}: ${turn.text.trim()}`);
  }

  console.log(`\n--- getTurnBoundaries (${boundaries.length}) ---`);
  for (const b of boundaries) {
    console.log(`[${(b.start_ms / 1000).toFixed(2)}-${(b.end_ms / 1000).toFixed(2)}] ${b.speaker_id}`);
  }

  console.log(`\n--- getEvents (${events.length}) ---`);
  for (const event of events) {
    console.log(`${event.type} frame=${(event.frame_ms / 1000).toFixed(2)}s commit=${(event.commit_ms / 1000).toFixed(2)}s`);
  }

  console.log(`\n--- getSpeakers (${speakers.length}) ---`);
  for (const speaker of speakers) {
    console.log(`${speaker.speaker_id}: talk=${(speaker.talk_ms / 1000).toFixed(1)}s turns=${speaker.turn_count}`);
  }

  const failures = [];
  if (turns.length === 0) failures.push('getTurns returned no turns');
  if (boundaries.length === 0) failures.push('getTurnBoundaries returned no boundaries');
  if (speakers.length === 0) failures.push('getSpeakers returned no speakers');
  if (turns.some((t) => !t.speaker_id || t.speaker_id === 'unknown')) failures.push('some turns are unattributed');
  if (failures.length) {
    console.error(`\nFAIL: ${failures.join('; ')}`);
    process.exit(1);
  }
  console.log('\nPASS: turns, boundaries, events, and speakers all returned attributed data');
} finally {
  if (minted) await revokeEphemeralKey(minted);
}
