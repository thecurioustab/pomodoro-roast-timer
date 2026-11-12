# 🔥 Roast Timer

A focus timer that roasts you every time you pick up your phone.

**Problem:** Students and working professionals lose focus because they keep reaching for their phone.
**Solution:** A fun timer that catches you in the act and roasts you for it — out loud.

## How it works

Meet **Gloop**, a grumpy little blob-frog who lives in your timer.

1. Press play and lay the phone flat on your desk. Gloop calibrates, then starts watching.
2. **Lift the phone** → the motion sensor notices, the screen shakes, the phone buzzes and Gloop roasts you out loud.
3. **Switch to another app** → when you come back, Gloop tells you exactly how long you were gone.
4. Roasts escalate with every slip (Mild / Spicy / Savage), and so does Gloop’s mood: friendly at first, angry after that.
5. It runs Pomodoro-style: focus → short break → … → long break. Each focus block ends with a grade (S–D) and a verdict.

### Screens
- **Focus**: Gloop + speech bubble, big timer, session dots, skip / play / reset.
- **Progress**: totals, an activity map of the last 18 weeks, and this week’s focus bars.
- **Settings**: focus/break lengths, sessions per set, roast level, lift sensitivity, voice, vibration, dark mode.

History and settings are stored locally in the browser.

## Run it

It's a plain HTML/CSS/JS PWA — no build step.

```bash
cd roast-timer
node serve.js
```

Open `http://localhost:8080` on your computer (tab-switch detection only).

### On your phone

Motion sensors and "Add to Home Screen" need **HTTPS** on phones. Easiest options:

- Deploy the folder to GitHub Pages, Netlify or Vercel (drag-and-drop works), then open the URL on your phone.
- Or tunnel your local server: `npx localtunnel --port 8080` / `ngrok http 8080`.

On iPhone, Safari will ask for motion permission when you tap Start — allow it.

## Gloop's voice

Gloop has two voices:

- **Babble**: cute pitched blips (pentatonic, so it always sounds sweet) while the speech bubble types. Each mood has its own sound: quick chirps when happy, slow low croaks when bored, a buzzy growl when angry. A little "rib-bit" croak plays before every roast. All of it is generated live in the browser, so no files are needed.
- **Real voice** for the punchlines: roasts, "welcome back" roasts, end-of-session verdicts and "break's over". The app plays a pre-made AI clip from `audio/` if one exists. Otherwise it uses the device's built-in voice, with pitch and speed tuned to Gloop's mood.

Both can be toggled in **Settings → Gloop's voice**, and **Hear Gloop** plays a sample.

### Generating the AI voice clips (ElevenLabs, free plan)

By default only a **core set of 17 lines** is voiced (8 roasts across Mild/Spicy/Savage, 2 welcome-back lines, one verdict per grade, a break-over line, and the test line). That's about 900 credits. The app prefers these lines whenever their clips exist, so Gloop's voice stays consistent. The core set is listed in `CORE_VOICE` in `roasts.js`; add lines there to voice more, or run with `--all` to voice all 54. The free plan gives 10,000 credits a month. Free-plan audio is for non-commercial use only; if you publish the app commercially, upgrade and generate the clips again.

1. **Create the voice.** Sign up at elevenlabs.io → **Voices** → **Voice Design**, and paste:
   > A small, round cartoon frog. Slightly raspy and a little nasal, warm and playful, with sarcastic best-friend energy and great comedic timing. Expressive, youthful, never mean.

   Use this preview text: *"Again? Your thumb has a gym membership at this point."* Generate, pick the take you like best, and save it as **Gloop**.
2. **Get your keys.** Open the Gloop voice and choose **Copy Voice ID**. Then go to profile icon → **API Keys** → create a key.
3. **Add them to `.env`.** Copy `.env.example` to `.env` (same folder) and fill in both values. `.env` is git-ignored.
4. **Try 4 sample lines first** (uses about 220 credits):
   ```bash
   node tools/generate-voice.mjs --sample
   ```
   Then open the app → **Settings → Hear Gloop**.
5. **Voice the core set** when you like it:
   ```bash
   node tools/generate-voice.mjs
   ```

Tips:
- Not happy with the voice? Design a new one, update the ID in `.env`, and run with `--force`.
- For a more expressive delivery, try `ELEVENLABS_MODEL=eleven_v3` in `.env`.
- Preview every line without using credits: `node tools/generate-voice.mjs --dry-run`.
- OpenAI also works: set `OPENAI_API_KEY` (optionally `OPENAI_VOICE`). It's paid, but costs only cents.

The clips land in `audio/` along with `audio/manifest.json`. Later runs only generate new or changed lines. Voiced lines may only use the `{task}` placeholder, and the clip says it as "your work".

## Files

| File | Purpose |
|------|---------|
| `index.html` | Focus, Progress and Settings screens, roast overlay, result sheet |
| `styles.css` | Clean light/dark theme, mascot styling |
| `app.js` | Pomodoro timer, pickup + app-switch detection, roasts, charts, settings |
| `gloop.js` | Gloop, an animated squishy blob-frog: breathing, jelly wobble, lip-sync, eyes that follow you. Moods: idle, watch, angry, grin, sleepy |
| `playground.html` | Try Gloop on its own: moods, talking, poking |
| `roasts.js` | Everything Gloop says. Add your own lines here |
| `voice.js` | Babble + croak sound engine, AI clip playback, built-in voice fallback |
| `tools/generate-voice.mjs` | Generates the AI voice clips into `audio/` |
| `manifest.json`, `sw.js`, `icon.svg` | Installable PWA + offline support |

## Tuning detection

In `app.js`:

- `THRESHOLD` — movement per Low/Medium/High sensitivity (lower = more sensitive)
- `STRIKES_NEEDED` — consecutive readings required (higher = fewer false alarms)
- `SETTLE_MS` — how long the phone must be still before the app arms

## Ideas for later

- AI-generated roasts personalised to your task
- Streaks, leaderboards, and roasting friends who slip
- Native Android app using foreground service to detect unlocks even when the app is in the background
