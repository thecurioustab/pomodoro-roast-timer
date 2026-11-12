// Gloop's voice.
//  - babble(): cute pitched blips while the speech bubble types (everyday chatter)
//  - croak():  a little "rib-bit" before a roast
//  - line():   real AI voice clip from audio/<id>.mp3 when available,
//              otherwise the device's built-in voice, tuned per mood.
window.GloopVoice = (() => {
  let ctx = null;
  let opts = { voice: true, babble: true };
  let active = [];        // scheduled babble oscillators
  let current = null;     // playing clip source
  const clipIds = new Set();
  const cache = new Map();

  // For lip-sync: when each babble blip fires, a meter on clip playback,
  // and a flag while the built-in voice is speaking.
  let blipTimes = [];
  let analyser = null, meterBuf = null;
  let ttsSpeaking = false;

  // ---------- audio context (must be unlocked by a tap on mobile) ----------
  function audio() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      meterBuf = new Float32Array(analyser.fftSize);
      analyser.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  ["pointerdown", "keydown", "touchend"].forEach((ev) =>
    document.addEventListener(ev, () => audio(), { passive: true })
  );

  // Which lines have a generated clip?
  fetch("audio/manifest.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((m) => { if (m && m.clips) Object.keys(m.clips).forEach((id) => clipIds.add(id)); })
    .catch(() => {});

  // ---------- babble ----------
  // Each mood has its own register, rhythm and timbre.
  const BABBLE = {
    idle:    { base: 420, range: 7,  gap: 0.075, type: "triangle", vol: 0.18 },
    bored:   { base: 290, range: 2,  gap: 0.115, type: "triangle", vol: 0.14 },
    watch:   { base: 340, range: 4,  gap: 0.085, type: "triangle", vol: 0.16 },
    cheeky:  { base: 500, range: 9,  gap: 0.065, type: "square",   vol: 0.06 },
    shocked: { base: 640, range: 12, gap: 0.055, type: "square",   vol: 0.06 },
    angry:   { base: 200, range: 4,  gap: 0.07,  type: "sawtooth", vol: 0.07 },
    grin:    { base: 540, range: 9,  gap: 0.062, type: "triangle", vol: 0.18 },
    sleepy:  { base: 250, range: 2,  gap: 0.14,  type: "sine",     vol: 0.16 },
  };
  const SCALE = [0, 2, 4, 7, 9, 12]; // pentatonic = always sounds cute

  function blip(t, freq, cfg, len = 0.07) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = cfg.type;
    o.frequency.setValueAtTime(freq * 1.12, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.88, t + len); // little downward "bloop"
    f.type = "lowpass";
    f.frequency.value = Math.min(freq * 5, 4000);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(cfg.vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(f).connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + len + 0.02);
    active.push(o);
    blipTimes.push(t);
  }

  function stopBabble() {
    active.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } });
    active = [];
    blipTimes = [];
  }

  function babble(text, mood = "idle") {
    if (!opts.babble || !audio()) return;
    stopBabble();
    const cfg = BABBLE[mood] || BABBLE.idle;
    const notes = SCALE.filter((s) => s <= cfg.range);
    const words = text.replace(/[^\w\s.,!?…'-]/g, "").split(/\s+/).filter(Boolean);
    let t = ctx.currentTime + 0.03, count = 0;
    for (const w of words) {
      const syllables = Math.min(2, Math.ceil(w.length / 4));
      for (let s = 0; s < syllables && count < 26; s++, count++) {
        let semi = notes[Math.floor(Math.random() * notes.length)];
        if (/\?$/.test(w) && s === syllables - 1) semi += 5; // questions go up
        blip(t, cfg.base * Math.pow(2, semi / 12), cfg);
        t += cfg.gap * (0.85 + Math.random() * 0.3);
      }
      t += /[.,!?…]$/.test(w) ? cfg.gap * 2.5 : cfg.gap * 0.6;
    }
  }

  // ---------- croak ----------
  function croak(mood = "idle") {
    if (!opts.babble || !audio()) return;
    const low = mood === "angry" ? 85 : 115;
    [[0, low], [0.2, low * 1.35]].forEach(([dt, freq]) => {
      const t = ctx.currentTime + dt;
      const o = ctx.createOscillator(), lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(freq, t);
      o.frequency.linearRampToValueAtTime(freq * 0.9, t + 0.16);
      lfo.type = "square";
      lfo.frequency.value = 32; // the rattly "rrr" of a croak
      lfoGain.gain.value = 0.12;
      f.type = "lowpass";
      f.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
      lfo.connect(lfoGain).connect(g.gain);
      o.connect(f).connect(g).connect(ctx.destination);
      o.start(t); lfo.start(t);
      o.stop(t + 0.2); lfo.stop(t + 0.2);
    });
  }

  // ---------- spoken lines ----------
  function stop() {
    stopBabble();
    try { current && current.stop(); } catch { /* ignore */ }
    current = null;
    ttsSpeaking = false;
    if (window.speechSynthesis) speechSynthesis.cancel();
  }

  async function playClip(id) {
    if (!clipIds.has(id) || !audio()) return false;
    try {
      let buf = cache.get(id);
      if (!buf) {
        const res = await fetch(`audio/${id}.mp3`);
        if (!res.ok) return false;
        buf = await ctx.decodeAudioData(await res.arrayBuffer());
        cache.set(id, buf);
      }
      stop();
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = 1.04; // a touch higher = a touch froggier
      src.connect(analyser);         // analyser -> speakers, and feeds lip-sync
      src.onended = () => { if (current === src) current = null; };
      src.start();
      current = src;
      return true;
    } catch {
      return false;
    }
  }

  // Built-in voice fallback, shaped per mood.
  const TTS_MOOD = {
    idle:    { pitch: 1.3,  rate: 1.0 },
    bored:   { pitch: 1.05, rate: 0.9 },
    watch:   { pitch: 1.15, rate: 0.95 },
    cheeky:  { pitch: 1.45, rate: 1.0 },
    shocked: { pitch: 1.7,  rate: 1.15 },
    angry:   { pitch: 0.85, rate: 0.95 },
    grin:    { pitch: 1.5,  rate: 1.05 },
    sleepy:  { pitch: 1.1,  rate: 0.85 },
  };
  const PREFERRED = ["Google UK English Male", "Daniel", "Microsoft Ryan", "Microsoft Guy", "Google US English", "Samantha", "Microsoft Aria"];
  let ttsVoice = null;
  function pickVoice() {
    if (!window.speechSynthesis) return;
    const voices = speechSynthesis.getVoices();
    ttsVoice =
      PREFERRED.map((n) => voices.find((v) => v.name.includes(n))).find(Boolean) ||
      voices.find((v) => /^en[-_]/i.test(v.lang)) || null;
  }
  if (window.speechSynthesis) {
    pickVoice();
    speechSynthesis.addEventListener?.("voiceschanged", pickVoice);
  }

  function tts(text, mood) {
    if (!window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}]/gu, ""));
      const m = TTS_MOOD[mood] || TTS_MOOD.idle;
      u.pitch = m.pitch;
      u.rate = m.rate;
      if (ttsVoice) u.voice = ttsVoice;
      u.onstart = () => { ttsSpeaking = true; };
      u.onend = u.onerror = () => { ttsSpeaking = false; };
      speechSynthesis.speak(u);
    } catch { /* ignore */ }
  }

  // template: the raw line (used to find its clip). text: what the bubble shows.
  async function line(template, text, mood, { croakFirst = false } = {}) {
    if (!opts.voice) return babble(text, mood);
    stop();
    if (croakFirst) {
      croak(mood);
      await new Promise((r) => setTimeout(r, 420));
    }
    if (await playClip(window.gloopId(template))) return;
    tts(text, mood);
  }

  // Unlock speech on iOS (needs a call inside a tap).
  function prime() {
    audio();
    if (opts.voice && window.speechSynthesis) {
      try { speechSynthesis.speak(new SpeechSynthesisUtterance("")); } catch { /* ignore */ }
    }
  }

  return {
    configure(o) { opts = Object.assign(opts, o); if (!opts.voice && !opts.babble) stop(); },
    babble, croak, line, stop, prime, audio,
    has: (template) => clipIds.has(window.gloopId(template)),
    // 0..1: how "open" Gloop's mouth should be right now.
    talkLevel() {
      let lvl = 0;
      if (ctx) {
        const now = ctx.currentTime;
        for (let i = blipTimes.length - 1; i >= 0; i--) {
          const dt = now - blipTimes[i];
          if (dt < 0) continue;              // scheduled for later
          if (dt < 0.1) lvl = 1 - dt / 0.1;  // mouth pops open on each blip
          break;
        }
        if (current && analyser) {
          analyser.getFloatTimeDomainData(meterBuf);
          let sum = 0;
          for (let i = 0; i < meterBuf.length; i++) sum += meterBuf[i] * meterBuf[i];
          lvl = Math.max(lvl, Math.min(1, Math.sqrt(sum / meterBuf.length) * 6));
        }
      }
      if (ttsSpeaking) {
        lvl = Math.max(lvl, 0.25 + 0.4 * Math.abs(Math.sin(performance.now() / 1000 * 11)));
      }
      return lvl;
    },
    get clipCount() { return clipIds.size; },
  };
})();
