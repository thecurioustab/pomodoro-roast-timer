(() => {
  "use strict";

  // ================= helpers =================
  const $ = (id) => document.getElementById(id);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
    },
  };
  const fmtClock = (sec) => {
    sec = Math.max(0, Math.ceil(sec));
    return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  };
  const fmtDur = (sec) => {
    sec = Math.round(sec);
    if (sec < 60) return `${sec}s`;
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  };
  const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // ================= icons =================
  const ICONS = {
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
    chart: '<path d="M3 21h18M6 17v-5M11 17V6M16 17v-8M21 17v-3"/>',
    sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    skip: '<path d="M6 5l10 7-10 7z"/><path d="M19 5v14"/>',
    play: '<path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z" fill="currentColor"/>',
    pause: '<rect x="6" y="4.5" width="4" height="15" rx="1.5" fill="currentColor"/><rect x="14" y="4.5" width="4" height="15" rx="1.5" fill="currentColor"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    coffee: '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3"/>',
    book: '<path d="M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2zM22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z"/>',
    repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    flame: '<path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 3-5 5-5 8 0 4 3 7 7 7z"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
    volume: '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
    mute: '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M22 9l-6 6M16 9l6 6"/>',
    vibrate: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M3 9v6M21 9v6"/>',
    moon: '<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    pencil: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  };
  const icon = (name) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`;
  document.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = icon(el.dataset.icon); });

  // ================= settings =================
  const settings = Object.assign(
    {
      focus: 25, short: 5, long: 15, sessions: 4,
      sensitivity: "medium",
      voice: true, babble: true, vibrate: true,
      dark: window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches,
      task: "",
    },
    store.get("rt2-settings", {})
  );
  const saveSettings = () => store.set("rt2-settings", settings);

  function applyTheme() {
    document.documentElement.dataset.theme = settings.dark ? "dark" : "light";
    document.querySelector('meta[name="theme-color"]').content = settings.dark ? "#151613" : "#FBF7EE";
  }
  applyTheme();

  // ================= mascot & speech =================
  // One animated Gloop per spot on the page (focus, roast, result, empty
  // state), created on first use. Moods: idle, watch, angry, grin, sleepy.
  const gloops = {};
  const POKE_LINES = ["Hey! That tickles!", "Boop!", "Rude. I'm squishy, not a button.", "Poke me again and I'm telling your phone."];
  function gloopFor(el) {
    if (!gloops[el.id]) {
      gloops[el.id] = new Gloop(el, {
        onPoke: el.id === "mascot"
          ? () => say(pick(POKE_LINES), { mood: moodOf.mascot === "sleepy" ? "idle" : moodOf.mascot })
          : null,
      });
      gloops[el.id].setTalkSource(() => Voice.talkLevel());
    }
    return gloops[el.id];
  }
  const moodOf = {};
  function setMood(mood, el = $("mascot")) {
    moodOf[el.id] = mood;
    gloopFor(el).setMood(mood);
  }

  const fill = (t, extra = {}) =>
    t.replaceAll("{task}", settings.task || "your work")
      .replaceAll("{n}", T.block ? T.block.pickups : 0)
      .replaceAll("{elapsed}", fmtDur(T.total - remaining()))
      .replaceAll("{away}", extra.away || "a while");

  const typers = {};
  function typeInto(el, text) {
    clearInterval(typers[el.id]);
    el.textContent = "";
    let i = 0;
    typers[el.id] = setInterval(() => {
      el.textContent = text.slice(0, ++i);
      if (i >= text.length) clearInterval(typers[el.id]);
    }, 18);
  }

  // Show a line in Gloop's bubble. Chatter is babbled; voice:true uses the
  // real voice (AI clip or built-in fallback). silent:true just shows text.
  function say(template, { mood, voice = false, silent = false } = {}) {
    if (mood) setMood(mood);
    const text = fill(template);
    const bubble = $("bubble");
    bubble.style.animation = "none"; void bubble.offsetWidth; bubble.style.animation = "";
    typeInto($("bubble-text"), text);
    if (silent) return;
    const m = mood || moodOf.mascot || "idle";
    if (voice) Voice.line(template, text, m);
    else Voice.babble(text, m);
  }

  const Voice = window.GloopVoice;
  // Use lines that have a real AI clip when there are any, so Gloop's voice
  // stays consistent; otherwise fall back to the full list.
  const preferVoiced = (arr) => {
    const v = arr.filter(Voice.has);
    return v.length ? v : arr;
  };
  const syncVoice = () => Voice.configure({ voice: settings.voice, babble: settings.babble });
  const buzz = (p) => { if (settings.vibrate && navigator.vibrate) navigator.vibrate(p); };

  function chime() {
    try {
      const ctx = Voice.audio();
      if (!ctx) return;
      [660, 880].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = f; o.type = "sine";
        g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
        g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.5);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + i * 0.18); o.stop(ctx.currentTime + i * 0.18 + 0.55);
      });
    } catch { /* ignore */ }
  }

  // ================= timer state =================
  // phase: focus | short | long. cycle = focus blocks finished in this set.
  const T = { phase: "focus", total: 0, rem: 0, endAt: 0, running: false, cycle: 0, block: null, nextPhase: "short" };
  const phaseSeconds = (p) => settings[p] * 60;
  const remaining = () => (T.running ? Math.max(0, (T.endAt - Date.now()) / 1000) : T.rem);

  function setPhase(phase, { quiet = false } = {}) {
    T.phase = phase;
    T.total = T.rem = phaseSeconds(phase);
    T.running = false;
    T.block = null;
    render();
    if (quiet) return;
    if (phase === "focus") say(pick(LINES.ready), { mood: "idle" });
    else say(pick(LINES.break), { mood: "sleepy" });
  }

  async function start() {
    if (T.running) return;
    if (T.phase === "focus") {
      await ensureMotion();
      primeSpeech();
      if (!T.block) T.block = { pickups: 0, distracted: 0 };
      recalibrate();
      nextChatAt = Date.now() + 45000;
    }
    T.endAt = Date.now() + T.rem * 1000;
    T.running = true;
    requestWakeLock();
    render();
    if (T.phase === "focus" && !window.isSecureContext && !warnedInsecure) {
      // Phones only share motion data with https pages.
      warnedInsecure = true;
      say("Heads up: on this link I can't feel the phone move. I'll still catch you switching apps!", { mood: "idle" });
    } else if (T.phase === "focus") say(pick(LINES.start), { mood: "watch" });
    else say(pick(LINES.break), { mood: "sleepy" });
  }
  let warnedInsecure = false;

  function pause() {
    if (!T.running) return;
    T.rem = remaining();
    T.running = false;
    releaseWakeLock();
    render();
    if (T.phase === "focus") say(pick(LINES.pause), { mood: "idle" });
  }

  function recordFocus(seconds) {
    const b = T.block || { pickups: 0, distracted: 0 };
    const focusSec = Math.max(0, seconds - b.distracted);
    if (seconds < 60) return focusSec;
    const history = store.get("rt-history", []);
    history.push({ date: new Date().toISOString(), focusSec, pickups: b.pickups, task: settings.task });
    store.set("rt-history", history.slice(-1000));
    return focusSec;
  }

  function resetPhase() {
    const done = T.total - remaining();
    if (T.phase === "focus" && T.block) recordFocus(done);
    releaseWakeLock();
    setPhase(T.phase, { quiet: true });
    if (T.phase === "focus" && done > 10) say(pick(LINES.reset), { mood: "idle" });
    else setPhase(T.phase);
  }

  function skip() {
    releaseWakeLock();
    if (T.phase === "focus") {
      if (T.block) recordFocus(T.total - remaining());
      setPhase("short");
      start();
    } else {
      endBreak();
    }
  }

  function onPhaseEnd() {
    T.running = false;
    T.rem = 0;
    releaseWakeLock();
    chime();
    if (T.phase === "focus") completeFocus();
    else endBreak();
  }

  function completeFocus() {
    const b = T.block;
    const focusSec = recordFocus(T.total);
    T.cycle++;
    T.nextPhase = T.cycle >= settings.sessions ? "long" : "short";
    render();
    showResult(b, focusSec);
  }

  function endBreak() {
    if (T.phase === "long") T.cycle = 0;
    setPhase("focus", { quiet: true });
    say(pick(preferVoiced(LINES.breakOver)), { mood: "grin", voice: true });
    buzz([120, 80, 120]);
  }

  // ================= tick =================
  let lastTick = Date.now(), nextChatAt = 0, lastAwayHandledAt = 0;
  setInterval(() => {
    const now = Date.now(), dt = (now - lastTick) / 1000;
    lastTick = now;
    if (!T.running) return;
    if (remaining() <= 0) return onPhaseEnd();
    // Backup for app-switch detection: phones freeze background pages, so a
    // long gap between ticks means we were away even if no visibility event
    // arrived (some mobile browsers skip it).
    if (dt > 3 && !document.hidden && detecting() && now - lastAwayHandledAt > 2000) {
      lastAwayHandledAt = now;
      awayRoast(dt);
    }
    if (T.phase === "focus" && !$("roast").hidden) T.block.distracted += dt;
    if (detecting() && now > nextChatAt && $("view-focus").classList.contains("active")) {
      nextChatAt = now + 40000 + Math.random() * 40000;
      say(pick(LINES.watch), { mood: "watch" });
    }
    renderClock();
  }, 250);

  // ================= render =================
  function renderClock() {
    const r = remaining();
    $("timer").textContent = fmtClock(r);
    document.title = T.running ? `${fmtClock(r)} · Roast Timer` : "Roast Timer";
    renderStatus();
  }

  function renderStatus() {
    const s = $("status");
    let text = "", armed = false;
    if (T.phase !== "focus") text = T.running ? "Break time. The phone is legal." : "Break ready";
    else if (!T.running) text = T.block ? "Paused" : "Lay your phone flat, then press play";
    else if (motion.supported && !motion.armed) text = "Settling… lay the phone flat and let go";
    else {
      armed = true;
      const n = T.block.pickups;
      const mode = motion.supported ? "Lift detection on"
        : window.isSecureContext ? "Watching for app switches"
        : "App switches only (lifting needs an https link)";
      text = `${mode} · ${n} pickup${n === 1 ? "" : "s"}`;
    }
    s.textContent = text;
    s.classList.toggle("armed", armed);
  }

  function render() {
    const isBreak = T.phase !== "focus";
    $("phase-label").textContent = T.phase === "focus" ? "Focus" : T.phase === "short" ? "Short break" : "Long break";
    $("phase-chip").classList.toggle("break", isBreak);
    $("phase-chip").classList.toggle("live", T.running);

    const play = $("play-btn");
    play.innerHTML = icon(T.running ? "pause" : "play");
    play.setAttribute("aria-label", T.running ? "Pause" : "Start");

    $("dots").innerHTML = Array.from({ length: settings.sessions }, (_, i) => {
      const cls = i < T.cycle ? "done" : i === T.cycle && T.phase === "focus" && T.block ? "current" : "";
      return `<i class="${cls}"></i>`;
    }).join("");

    const audible = settings.voice || settings.babble;
    $("mute-btn").innerHTML = icon(audible ? "volume" : "mute");
    $("mute-btn").setAttribute("aria-label", audible ? "Mute Gloop" : "Unmute Gloop");

    const chip = $("task-chip");
    chip.classList.toggle("has-task", !!settings.task);
    $("task-text").textContent = settings.task || "What are you working on?";
    renderClock();
  }

  // ================= controls =================
  $("play-btn").addEventListener("click", () => (T.running ? pause() : start()));
  $("reset-btn").addEventListener("click", resetPhase);
  $("skip-btn").addEventListener("click", skip);
  $("mute-btn").addEventListener("click", () => {
    const on = !(settings.voice || settings.babble);
    settings.voice = settings.babble = on;
    syncVoice(); saveSettings(); syncSettingsUI(); render();
  });
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && e.target === document.body && $("view-focus").classList.contains("active")) {
      e.preventDefault(); T.running ? pause() : start();
    }
  });

  // Task chip -> inline input
  $("task-chip").addEventListener("click", () => {
    $("task-chip").hidden = true;
    const input = $("task-input");
    input.hidden = false; input.value = settings.task; input.focus();
  });
  const commitTask = () => {
    settings.task = $("task-input").value.trim();
    saveSettings();
    $("task-input").hidden = true; $("task-chip").hidden = false;
    render();
  };
  $("task-input").addEventListener("blur", commitTask);
  $("task-input").addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); });

  const primeSpeech = () => Voice.prime();

  // ================= roast =================
  // Every roast from every level, shuffled like a deck of cards: each one
  // plays once before any repeats, and the deck is remembered between
  // sessions. Voiced lines only, when their clips exist.
  const ALL_ROASTS = Object.values(ROASTS).flatMap((l) => [...l.first, ...l.repeat, ...l.many]);
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function drawFrom(deckKey, lines) {
    const pool = preferVoiced(lines);
    const recent = store.get(`${deckKey}-recent`, []);
    let deck = store.get(deckKey, []).filter((t) => pool.includes(t));
    if (!deck.length) {
      // New shuffle, but the last few lines heard go to the back, so a
      // roast never comes round again just a couple of pickups later.
      const shuffled = shuffle(pool.slice());
      deck = [...shuffled.filter((t) => !recent.includes(t)), ...shuffled.filter((t) => recent.includes(t))];
    }
    const line = deck.shift();
    const keep = Math.max(1, Math.min(6, Math.floor(pool.length / 2)));
    store.set(deckKey, deck);
    store.set(`${deckKey}-recent`, [...recent.filter((t) => t !== line), line].slice(-keep));
    return line;
  }

  let lastRoastAt = 0;
  function registerPickup({ template, chip } = {}) {
    if (!T.block || Date.now() - lastRoastAt < 6000) return;
    lastRoastAt = Date.now();
    T.block.pickups++;
    const n = T.block.pickups;
    template = template || drawFrom("rt-roast-deck", ALL_ROASTS);
    const text = fill(template);
    // First slip: normal Gloop, just talking. After that: angry.
    const mood = n === 1 ? "idle" : "angry";

    $("roast-count").textContent = chip || `Pickup #${n}`;
    setMood(mood, $("roast-mascot"));
    $("roast").hidden = false;
    gloopFor($("roast-mascot")).jiggle(1.3);
    typeInto($("roast-text"), text);
    setMood("angry");
    buzz([200, 100, 200, 100, 400]);
    Voice.line(template, text, mood, { croakFirst: true });
    render();
  }

  $("roast-ok").addEventListener("click", () => {
    $("roast").hidden = true;
    Voice.stop();
    recalibrate();
    say(pick(LINES.afterRoast), { mood: "watch" });
  });

  // ================= result sheet =================
  function showResult(b, focusSec) {
    const distractedShare = T.total ? b.distracted / T.total : 0;
    const score = Math.max(0, Math.min(100, Math.round(100 - b.pickups * 12 - distractedShare * 60)));
    const grade = score >= 95 && b.pickups === 0 ? "S" : score >= 80 ? "A" : score >= 65 ? "B" : score >= 45 ? "C" : "D";
    const mood = { S: "grin", A: "grin", B: "idle", C: "idle", D: "angry" }[grade];

    $("grade").textContent = grade;
    $("grade").classList.toggle("low", grade === "C" || grade === "D");
    $("result-title").textContent = grade === "D" ? "Phone 1, You 0" : "Session complete";
    $("result-sub").textContent = `Session ${T.cycle} of ${settings.sessions}${settings.task ? " · " + settings.task : ""}`;
    setMood(mood, $("result-mascot"));
    const verdict = pick(preferVoiced(VERDICTS[grade]));
    typeInto($("result-verdict"), verdict);
    $("r-focus").textContent = fmtDur(focusSec);
    $("r-pickups").textContent = b.pickups;
    $("r-score").textContent = score;
    $("start-break-btn").textContent = T.nextPhase === "long" ? `Start long break (${settings.long}m)` : `Start break (${settings.short}m)`;
    $("result").hidden = false;
    say(verdict, { mood, silent: true });
    Voice.line(verdict, verdict, mood);
    buzz([100, 80, 100, 80, 300]);
  }

  $("start-break-btn").addEventListener("click", () => {
    $("result").hidden = true;
    setPhase(T.nextPhase, { quiet: true });
    start();
  });
  $("skip-break-btn").addEventListener("click", () => {
    $("result").hidden = true;
    if (T.nextPhase === "long") T.cycle = 0;
    setPhase("focus");
  });

  // ================= motion detection =================
  // Phone resting flat -> gravity vector is steady. Once it settles we lock a
  // baseline; a sustained swing away from it means someone picked it up.
  const motion = { listening: false, supported: false, armed: false, baseline: null, samples: [], strikes: 0, stillSince: 0 };
  const THRESHOLD = { low: 3.2, medium: 2.2, high: 1.4 };
  const STILL_TOLERANCE = 0.6, STRIKES_NEEDED = 4, SETTLE_MS = 2000;

  const detecting = () => T.phase === "focus" && T.running && $("roast").hidden && $("result").hidden;

  function recalibrate() {
    Object.assign(motion, { armed: false, baseline: null, samples: [], strikes: 0, stillSince: 0 });
  }

  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const average = (list) => {
    const s = [0, 0, 0];
    list.forEach((v) => { s[0] += v[0]; s[1] += v[1]; s[2] += v[2]; });
    return s.map((x) => x / list.length);
  };

  function onMotion(e) {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null) return;
    motion.supported = true;
    if (!detecting()) return;
    const v = [a.x, a.y, a.z], now = performance.now();

    if (!motion.armed) {
      motion.samples.push(v);
      if (motion.samples.length > 30) motion.samples.shift();
      const avg = average(motion.samples);
      if (dist(v, avg) < STILL_TOLERANCE) {
        if (!motion.stillSince) motion.stillSince = now;
        if (now - motion.stillSince > SETTLE_MS && motion.samples.length >= 10) {
          motion.baseline = avg;
          motion.armed = true;
          renderStatus();
        }
      } else {
        motion.stillSince = 0;
      }
      return;
    }

    if (dist(v, motion.baseline) > THRESHOLD[settings.sensitivity]) {
      if (++motion.strikes >= STRIKES_NEEDED) { recalibrate(); registerPickup(); }
    } else {
      motion.strikes = 0;
    }
  }

  async function ensureMotion() {
    if (motion.listening || typeof DeviceMotionEvent === "undefined") return;
    if (typeof DeviceMotionEvent.requestPermission === "function") {
      try { if ((await DeviceMotionEvent.requestPermission()) !== "granted") return; } catch { return; }
    }
    window.addEventListener("devicemotion", onMotion);
    motion.listening = true;
  }

  // ================= app-switch detection =================
  let hiddenAt = null;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (detecting()) hiddenAt = Date.now();
      Voice.stop();
      return;
    }
    requestWakeLock();
    if (hiddenAt == null) return;
    const awaySec = (Date.now() - hiddenAt) / 1000;
    hiddenAt = null;
    lastAwayHandledAt = Date.now();
    lastTick = Date.now(); // so the gap check in the tick doesn't count it twice
    if (!detecting() || remaining() <= 0) return;
    awayRoast(awaySec);
  });

  function awayRoast(awaySec) {
    T.block.distracted += awaySec;
    if (awaySec < 3) return;
    Voice.audio(); // wake the audio engine; phones pause it in the background
    registerPickup({ template: drawFrom("rt-return-deck", RETURN_ROASTS), chip: `Gone for ${fmtDur(awaySec)}` });
  }

  // ================= wake lock =================
  let wakeLock = null;
  async function requestWakeLock() {
    try { if (T.running && "wakeLock" in navigator && !document.hidden) wakeLock = await navigator.wakeLock.request("screen"); } catch { /* ignore */ }
  }
  function releaseWakeLock() {
    try { wakeLock && wakeLock.release(); } catch { /* ignore */ }
    wakeLock = null;
  }

  // ================= tabs =================
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const view = tab.dataset.view;
      document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
      document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
      if (view === "progress") renderProgress();
      window.scrollTo(0, 0);
    });
  });

  // ================= settings UI =================
  const unit = (key, v) => (key === "sessions" ? `${v}` : `${v}m`);

  function syncSettingsUI() {
    document.querySelectorAll('input[type="range"][data-key]').forEach((r) => {
      const key = r.dataset.key;
      r.value = settings[key];
      r.style.setProperty("--pct", `${((settings[key] - r.min) / (r.max - r.min)) * 100}%`);
      $(`v-${key}`).textContent = unit(key, settings[key]);
    });
    [["seg-sensitivity", "sensitivity"]].forEach(([id, key]) => {
      $(id).querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.v === settings[key]));
    });
    $("t-voice").checked = settings.voice;
    $("t-babble").checked = settings.babble;
    $("t-vibrate").checked = settings.vibrate;
    $("t-dark").checked = settings.dark;
  }

  document.querySelectorAll('input[type="range"][data-key]').forEach((r) => {
    r.addEventListener("input", () => {
      const key = r.dataset.key;
      settings[key] = Number(r.value);
      if (key === "sessions" && T.cycle >= settings.sessions) T.cycle = 0;
      saveSettings();
      syncSettingsUI();
      // Apply right away if the current phase hasn't started yet.
      if (!T.running && !T.block && key === T.phase) { T.total = T.rem = phaseSeconds(key); }
      render();
    });
  });
  [["seg-sensitivity", "sensitivity"]].forEach(([id, key]) => {
    $(id).addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      settings[key] = b.dataset.v;
      saveSettings(); syncSettingsUI();
    });
  });
  $("t-voice").addEventListener("change", (e) => { settings.voice = e.target.checked; syncVoice(); saveSettings(); render(); });
  $("t-babble").addEventListener("change", (e) => { settings.babble = e.target.checked; syncVoice(); saveSettings(); render(); });
  $("test-voice-btn").addEventListener("click", async () => {
    Voice.prime();
    const btn = $("test-voice-btn");
    btn.disabled = true;
    Voice.babble("Ribbit! Hello there, friend. This is how I chat.", "grin");
    await new Promise((r) => setTimeout(r, 1900));
    // Its own shuffled deck, so testing doesn't use up the real roast deck.
    const template = drawFrom("rt-test-deck", ALL_ROASTS);
    await Voice.line(template, fill(template), "idle", { croakFirst: true });
    $("voice-source").textContent = Voice.clipCount
      ? `AI voice · ${Voice.clipCount} clips`
      : "Built-in voice (no AI clips yet)";
    setTimeout(() => { btn.disabled = false; }, 1500);
  });
  $("t-vibrate").addEventListener("change", (e) => { settings.vibrate = e.target.checked; saveSettings(); });
  $("t-dark").addEventListener("change", (e) => { settings.dark = e.target.checked; saveSettings(); applyTheme(); });
  $("clear-btn").addEventListener("click", () => {
    if (confirm("Clear all your focus history? This can't be undone.")) {
      store.set("rt-history", []);
      renderProgress();
    }
  });

  // ================= progress =================
  const WEEKS = 18;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function renderProgress() {
    const history = store.get("rt-history", []);
    const byDay = {};
    history.forEach((h) => {
      const k = dayKey(new Date(h.date));
      const d = (byDay[k] ||= { min: 0, pickups: 0 });
      d.min += h.focusSec / 60;
      d.pickups += h.pickups;
    });

    // Stats
    const totalSec = history.reduce((a, h) => a + h.focusSec, 0);
    $("st-focus").textContent = fmtDur(totalSec);
    $("st-sessions").textContent = history.length;
    $("st-roasts").textContent = history.reduce((a, h) => a + h.pickups, 0);
    let streak = 0;
    const cur = new Date(); cur.setHours(0, 0, 0, 0);
    if (!byDay[dayKey(cur)]) cur.setDate(cur.getDate() - 1);
    while (byDay[dayKey(cur)]) { streak++; cur.setDate(cur.getDate() - 1); }
    $("st-streak").textContent = streak;

    const empty = history.length === 0;
    $("progress-empty").hidden = !empty;
    if (empty) setMood("watch", $("empty-mascot"));

    // Heatmap: columns are weeks (Mon-first), rows are days.
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const start = new Date(monday); start.setDate(monday.getDate() - 7 * (WEEKS - 1));
    const level = (m) => (!m ? 0 : m < 15 ? 1 : m < 45 ? 2 : m < 90 ? 3 : 4);

    let html = "<span></span>";
    let lastMonth = -1;
    for (let w = 0; w < WEEKS; w++) {
      const d = new Date(start); d.setDate(start.getDate() + 7 * w);
      const m = d.getMonth();
      // Skip a label in the first column if the month changes right after (avoids overlap).
      const nextWeek = new Date(d); nextWeek.setDate(d.getDate() + 14);
      const show = m !== lastMonth && !(w === 0 && nextWeek.getMonth() !== m);
      html += `<span class="mo">${show ? MONTHS[m] : ""}</span>`;
      if (show || w === 0) lastMonth = m;
    }
    for (let r = 0; r < 7; r++) {
      html += `<span class="dl">${r % 2 === 0 ? DAYS[r][0] : ""}</span>`;
      for (let w = 0; w < WEEKS; w++) {
        const d = new Date(start); d.setDate(start.getDate() + 7 * w + r);
        const k = dayKey(d), info = byDay[k];
        const cls = d > today ? "future" : `l${level(info && info.min)}${+d === +today ? " today" : ""}`;
        const tip = `${d.toDateString()}: ${info ? Math.round(info.min) + " min" : "no focus"}`;
        html += `<i class="c ${cls}" title="${tip}"></i>`;
      }
    }
    const heat = $("heat");
    heat.style.setProperty("--weeks", WEEKS);
    heat.innerHTML = html;

    // Weekly bars (this Mon-Sun)
    const week = DAYS.map((_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const info = byDay[dayKey(d)];
      return { min: info ? info.min : 0, pickups: info ? info.pickups : 0, today: +d === +today };
    });
    const max = Math.max(...week.map((d) => d.min));
    const scale = Math.max(60, Math.ceil(max / 60) * 60);
    $("bars").innerHTML = week.map((d, i) => {
      const isMax = max > 0 && d.min === max;
      const h = d.min ? Math.max(4, (d.min / scale) * 100) : 0;
      return `<div class="bar-col">
        <div class="bar-track"><div class="bar ${d.min ? "" : "zero"} ${isMax ? "max" : ""}" style="height:${h}%">
          ${isMax ? `<span class="bar-tip">${Math.round(d.min)} min</span>` : ""}
        </div></div>
        <span class="bar-day ${d.today ? "today" : ""}">${DAYS[i]}</span>
      </div>`;
    }).join("");
    const weekMin = week.reduce((a, d) => a + d.min, 0);
    const weekRoasts = week.reduce((a, d) => a + d.pickups, 0);
    $("week-sub").textContent = `${fmtDur(weekMin * 60)} focused · roasted ${weekRoasts} time${weekRoasts === 1 ? "" : "s"}`;
  }

  // ================= boot =================
  syncVoice();
  syncSettingsUI();
  setPhase("focus");

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
