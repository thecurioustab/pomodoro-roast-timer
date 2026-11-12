#!/usr/bin/env node
// Generates Gloop's AI voice clips into ../audio/ (one mp3 per voiced line)
// plus audio/manifest.json, which the app reads to know which clips exist.
//
// Usage (from the roast-timer folder):
//   node tools/generate-voice.mjs --dry-run   # list lines, no API calls
//   node tools/generate-voice.mjs --sample    # 4 lines, to audition the voice
//   node tools/generate-voice.mjs             # core set (8 roasts + basics)
//   node tools/generate-voice.mjs --all       # every voiceable line
//
// Keys come from a .env file in the roast-timer folder (see .env.example)
// or from environment variables:
//   ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID   (optional ELEVENLABS_MODEL)
//   or OPENAI_API_KEY                          (optional OPENAI_VOICE, OPENAI_MODEL)
//
// Options: --force (regenerate existing clips), --only=<style> (e.g. savage)
//
// Keys are only read, never printed or written anywhere.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "audio");
const args = new Set(process.argv.slice(2));
const only = [...args].find((a) => a.startsWith("--only="))?.split("=")[1];
const force = args.has("--force");
const dryRun = args.has("--dry-run");
const sample = args.has("--sample");
const all = args.has("--all"); // every voiceable line instead of the core set

// Load .env (KEY=value per line) without overriding real environment vars.
const envFile = path.join(ROOT, ".env");
if (fs.existsSync(envFile)) {
  for (const raw of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || raw.trim().startsWith("#")) continue;
    const value = m[2].replace(/^["']|["']$/g, "");
    if (value && !process.env[m[1]]) process.env[m[1]] = value;
  }
}

// Load roasts.js exactly as the browser does.
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "roasts.js"), "utf8"), sandbox);
const { VOICED, gloopId } = sandbox.window;

// ---------- Gloop's character ----------
const CHARACTER =
  "You are Gloop, a small, round cartoon frog who lives inside a focus timer. " +
  "Voice: slightly raspy and a little nasal, warm, playful and expressive, like a sarcastic best friend " +
  "who teases you because they care. Great comedic timing: a tiny pause before the punchline, " +
  "lean on the funny words. Never truly mean, always affectionate underneath.";

const STYLE = {
  mild: "Delivery: gentle and amused, a fond eye-roll, encouraging.",
  spicy: "Delivery: smug, sassy and playful, light mock disbelief.",
  savage: "Delivery: dramatic, deadpan exasperation, over-the-top theatrical, like a disappointed drama coach.",
  return: "Delivery: mock-suspicious and faux-offended, like catching a friend sneaking back in.",
  proud: "Delivery: genuinely delighted and celebratory, a little impressed.",
  disappointed: "Delivery: theatrically disappointed sigh, then playful.",
  cheerful: "Delivery: bright, bouncy wake-up call, upbeat.",
};

// The {task} placeholder is spoken generically, since clips are pre-made.
const spoken = (t) => t.replaceAll("{task}", "your work").replace(/[\u{1F300}-\u{1FAFF}]/gu, "").trim();

// ---------- providers ----------
async function openai(text, style) {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini-tts",
      voice: process.env.OPENAI_VOICE || "ash",
      input: text,
      instructions: `${CHARACTER} ${STYLE[style] || ""}`,
      response_format: "mp3",
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function elevenlabs(text, style) {
  const voice = process.env.ELEVENLABS_VOICE_ID;
  const expressive = style === "savage" || style === "return" || style === "disappointed";
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
      voice_settings: { stability: expressive ? 0.3 : 0.45, similarity_boost: 0.8, style: expressive ? 0.7 : 0.45 },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

const provider =
  process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID ? { name: "elevenlabs", run: elevenlabs }
  : process.env.OPENAI_API_KEY ? { name: "openai", run: openai }
  : null;

// ---------- main ----------
let lines = VOICED(all).filter((l) => !only || l.style === only);
if (sample) {
  // One of each flavour: the "Hear Gloop" test line plus mild, savage and a comeback.
  const firstOf = (style) => lines.find((l) => l.style === style);
  lines = [lines[lines.length - 1], firstOf("mild"), firstOf("savage"), firstOf("return")].filter(Boolean);
}
const unique = [...new Map(lines.map((l) => [gloopId(l.text), l])).entries()];

if (dryRun) {
  unique.forEach(([id, l]) => console.log(`${id}  [${l.style}]  ${spoken(l.text)}`));
  const chars = unique.reduce((a, [, l]) => a + spoken(l.text).length, 0);
  console.log(`\n${unique.length} lines, ${chars} characters total.`);
  process.exit(0);
}

if (!provider) {
  console.error(
    "No API key found.\n" +
    "Copy .env.example to .env in the roast-timer folder and fill in\n" +
    "ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID (or OPENAI_API_KEY).\n" +
    "Tip: run with --dry-run to preview the lines."
  );
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });
const manifestPath = path.join(OUT, "manifest.json");
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : { clips: {} };
manifest.provider = provider.name;

let made = 0, skipped = 0, failed = 0;
for (const [id, l] of unique) {
  const file = path.join(OUT, `${id}.mp3`);
  if (!force && fs.existsSync(file)) { manifest.clips[id] = l.text; skipped++; continue; }
  try {
    process.stdout.write(`🐸 [${l.style}] ${spoken(l.text)} … `);
    fs.writeFileSync(file, await provider.run(spoken(l.text), l.style));
    manifest.clips[id] = l.text;
    made++;
    console.log("ok");
  } catch (e) {
    failed++;
    console.log("FAILED\n   " + e.message.slice(0, 300));
    // Wrong key / voice ID / no credits: every other line would fail too.
    if (/ (401|402|403|404|429):/.test(e.message)) { console.log("Stopping early."); break; }
  }
}

// Drop clips whose lines no longer exist in roasts.js
const current = new Set(VOICED(true).map((l) => gloopId(l.text)));
for (const id of Object.keys(manifest.clips)) if (!current.has(id)) delete manifest.clips[id];

manifest.generated = new Date().toISOString();
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`\nDone with ${provider.name}: ${made} new, ${skipped} already existed, ${failed} failed.`);
if (sample && made + skipped > 0) {
  console.log("Open the app → Settings → Hear Gloop to listen (or play the mp3s in audio/).");
  console.log("Happy with it? Run again without --sample to voice the remaining lines.");
}
if (failed && provider.name === "elevenlabs") {
  console.log("401 = check the API key · 404 = check the Voice ID · 429/quota = out of free credits this month.");
}
