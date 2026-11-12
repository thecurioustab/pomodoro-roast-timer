// Gloop v2 — a soft, squishy, living blob-frog.
//
//   const g = new Gloop(containerEl, { onPoke })
//   g.setMood("angry")           idle | watch | angry | grin | sleepy
//   g.setTalkSource(() => 0..1)  mouth + body follow this level every frame
//   g.jiggle(strength)           wobble like jelly
//
// Everything is drawn procedurally: the body is a smooth curve through
// spring-loaded points, so it can squash, stretch and wobble. One shared
// animation loop drives every Gloop on the page and skips hidden ones.
window.Gloop = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const INK = "#1E1E1C", SKIN = "#97C94B", PINK = "#F06A9B", RED = "#E8573A";
  const OW = 4.5;          // outline width
  const ER = 19;           // eye radius
  const MOUTH_Y = -58;
  const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Body silhouette, origin at ground centre, y up = negative. A soft dome
  // with a saggy beanbag bottom; deliberately a little asymmetric.
  const BASE = [
    [0, 3], [46, 2], [73, -12], [80, -50], [63, -86], [31, -99],
    [-1, -96], [-32, -98], [-64, -85], [-79, -49], [-71, -11], [-45, 2],
  ];
  const CENTER_Y = -55;

  // ---------- moods ----------
  const DEFAULT = {
    sx: 1, sy: 1, hop: 0,
    mw: 30, mc: 8, mo: 0, skew: 0, tongue: 0, teeth: 0,
    lid: 0.08, tilt: 0, pupil: 7, brow: 0,
    blush: 0.35, red: 0, sweat: 0, zzz: 0,
    arms: "rest", closed: null, gazeStyle: "roam",
  };
  // Only the moods the app needs.
  const MOODS = {
    idle:   {},                                                                         // normal, friendly
    watch:  { sx: 1.02, sy: 0.99, mw: 26, mc: 3, skew: 5, lid: 0.45, pupil: 6, blush: 0.1, arms: "hips", gazeStyle: "suspicious" }, // timer running
    angry:  { sx: 1.1, sy: 0.93, mw: 28, mc: -9, lid: 0.28, tilt: 7, pupil: 5.2, brow: -1, blush: 0, red: 1, arms: "hips", gazeStyle: "fixed" }, // roasting
    grin:   { sy: 1.03, hop: 1, mw: 46, mc: 16, mo: 0.55, teeth: 1, lid: 0, pupil: 8, blush: 0.5, arms: "up" },          // proud / happy
    sleepy: { sx: 1.14, sy: 0.84, mw: 18, mc: 5, lid: 1, closed: "sleep", blush: 0.3, zzz: 1, gazeStyle: "fixed" },     // breaks
  };
  const NUMERIC = Object.keys(DEFAULT).filter((k) => typeof DEFAULT[k] === "number");

  // Hand targets per arm pose (relative to ground centre).
  const POSES = {
    rest: { L: [-92, -4], R: [92, -4], bend: 12 },
    up:   { L: [-102, -116], R: [102, -116], bend: 12 },
    hips: { L: [-77, -32], R: [77, -32], bend: 26 },
    wave: { L: [-92, -4], R: [100, -120], bend: 12 },
  };

  // ---------- helpers ----------
  const f = (n) => Math.round(n * 10) / 10;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const set = (e, attrs) => { for (const k in attrs) e.setAttribute(k, attrs[k]); };
  const mixColor = (a, b, k) => {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (s) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, k));
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  };

  // Closed Catmull-Rom spline -> smooth cubic Bézier path.
  function smooth(pts) {
    const n = pts.length;
    let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ` +
           `${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
    }
    return d + "Z";
  }

  // ---------- shared input + loop ----------
  const pointer = { x: 0, y: 0, at: -1e9 };
  window.addEventListener("pointermove", (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.at = performance.now(); }, { passive: true });
  const tilt = { x: 0, y: 0, at: -1e9 };
  window.addEventListener("devicemotion", (e) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null) return;
    tilt.x = a.x; tilt.y = a.y; tilt.at = performance.now();
  }, { passive: true });

  const instances = new Set();
  let last = performance.now(), lastBoil = 0, seed = 1, uid = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (now - lastBoil > 125) { seed = (seed % 50) + 1; lastBoil = now; instances.forEach((g) => g.reseed(seed)); }
    instances.forEach((g) => { if (g.visible()) g.update(dt, now / 1000, now); });
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---------- the character ----------
  class GloopChar {
    constructor(container, opts = {}) {
      this.container = container;
      this.opts = Object.assign({ boil: !reduceMotion, interactive: true, onPoke: null }, opts);
      this.id = `gloop${++uid}`;
      this.mood = "idle";
      this.target = Object.assign({}, DEFAULT);
      this.p = Object.assign({}, DEFAULT);
      this.off = BASE.map(() => [0, 0]);
      this.vel = BASE.map(() => [0, 0]);
      this.sq = { x: 1, y: 1, vx: 0, vy: 0 };
      this.hands = { L: POSES.rest.L.slice(), R: POSES.rest.R.slice() };
      this.gaze = { x: 0, y: 0 };
      this.gazeT = { x: 0, y: 0 };
      this.nextSaccade = 0;
      this.nextBlink = 1.5;
      this.blinkAt = -10;
      this.squintUntil = 0;
      this.talk = 0;
      this.talkSource = null;
      this.build();
      instances.add(this);
    }

    build() {
      const svg = el("svg", { viewBox: "-135 -178 270 196", class: "gloop-svg", role: "img", "aria-label": "Gloop the frog" });
      this.svg = svg;
      const defs = el("defs", {}, svg);
      const filt = el("filter", { id: `${this.id}-boil`, x: "-10%", y: "-10%", width: "120%", height: "120%" }, defs);
      this.turb = el("feTurbulence", { type: "fractalNoise", baseFrequency: "0.035", numOctaves: "2", seed: "1" }, filt);
      el("feDisplacementMap", { in: "SourceGraphic", scale: "2.4", xChannelSelector: "R", yChannelSelector: "G" }, filt);
      this.mouthClip = el("path", {}, el("clipPath", { id: `${this.id}-mouth` }, defs));
      this.eyeClips = [-1, 1].map((s) => el("circle", { r: ER }, el("clipPath", { id: `${this.id}-eye${s}` }, defs)));

      this.shadow = el("ellipse", { cx: 0, cy: 6, ry: 7, fill: "rgba(0,0,0,0.13)" }, svg);
      this.root = el("g", {}, svg);
      this.drawn = el("g", this.opts.boil ? { filter: `url(#${this.id}-boil)` } : {}, this.root);

      // Outline layer (fat ink strokes) under a fill layer = one merged silhouette.
      const out = el("g", { fill: INK, stroke: INK, "stroke-width": OW * 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, this.drawn);
      const fill = el("g", { fill: SKIN, stroke: "none" }, this.drawn);
      const limbs = (layer, isOut) => ({
        footL: el("ellipse", { rx: 19, ry: 9 }, layer),
        footR: el("ellipse", { rx: 19, ry: 9 }, layer),
        armL: el("path", { fill: "none", stroke: isOut ? INK : SKIN, "stroke-width": isOut ? 7 + OW * 2 : 7, "stroke-linecap": "round" }, layer),
        armR: el("path", { fill: "none", stroke: isOut ? INK : SKIN, "stroke-width": isOut ? 7 + OW * 2 : 7, "stroke-linecap": "round" }, layer),
        handL: el("circle", { r: 8.5 }, layer),
        handR: el("circle", { r: 8.5 }, layer),
        thumbL: el("circle", { r: 4.6 }, layer),
        thumbR: el("circle", { r: 4.6 }, layer),
        body: el("path", {}, layer),
        // Eye bumps grow out of the head, so they share its outline
        bumpL: el("circle", { r: ER + 4.5 }, layer),
        bumpR: el("circle", { r: ER + 4.5 }, layer),
      });
      this.o = limbs(out, true);
      this.fl = limbs(fill, false);

      const face = el("g", {}, this.drawn);
      this.cheeks = [-1, 1].map(() => el("ellipse", { rx: 10, ry: 5.5 }, face));
      this.tongueOut = el("path", { fill: PINK, stroke: INK, "stroke-width": 3.5, "stroke-linejoin": "round" }, face);
      this.mouth = el("path", { stroke: INK, "stroke-width": OW, "stroke-linejoin": "round", "stroke-linecap": "round" }, face);
      const mouthInside = el("g", { "clip-path": `url(#${this.id}-mouth)` }, face);
      this.tongueIn = el("ellipse", { fill: PINK }, mouthInside);
      this.teethLine = el("path", { fill: "none", stroke: INK, "stroke-width": 2.5, "stroke-linecap": "round" }, face);

      this.eyes = [-1, 1].map((s, i) => {
        const g = el("g", {}, face);
        const inner = el("g", { "clip-path": `url(#${this.id}-eye${s})` }, g);
        return {
          s, clip: this.eyeClips[i],
          white: el("circle", { r: ER, fill: "#fff" }, inner),
          pupil: el("circle", { fill: INK }, inner),
          shine: el("circle", { fill: "#fff" }, inner),
          lid: el("path", { fill: SKIN }, inner),
          lidLine: el("path", { fill: "none", stroke: INK, "stroke-width": 4, "stroke-linecap": "round" }, inner),
          ring: el("circle", { r: ER, fill: "none", stroke: INK, "stroke-width": OW }, g),
          arc: el("path", { fill: "none", stroke: INK, "stroke-width": 4.5, "stroke-linecap": "round" }, g),
          brow: el("path", { fill: "none", stroke: INK, "stroke-width": 4.5, "stroke-linecap": "round" }, g),
        };
      });

      this.sweat = el("path", { fill: "#8FD3FF", stroke: INK, "stroke-width": 3 }, this.drawn);
      this.zzz = [0, 1].map((i) => el("text", { "font-family": "Fredoka, Outfit, sans-serif", "font-weight": 600, "font-size": i ? 15 : 22, fill: "#8C877A" }, svg));
      this.zzz.forEach((z) => { z.textContent = "z"; });

      this.container.innerHTML = "";
      this.container.appendChild(svg);

      if (this.opts.interactive) {
        svg.style.cursor = "pointer";
        svg.addEventListener("pointerdown", (e) => { e.preventDefault(); this.poke(); });
      }
    }

    visible() { return this.svg.isConnected && this.svg.getClientRects().length > 0; }
    reseed(s) { if (this.opts.boil) this.turb.setAttribute("seed", s); }
    destroy() { instances.delete(this); this.svg.remove(); }

    setBoil(on) {
      this.opts.boil = on;
      if (on) this.drawn.setAttribute("filter", `url(#${this.id}-boil)`);
      else this.drawn.removeAttribute("filter");
    }

    setMood(mood) {
      if (!MOODS[mood] || mood === this.mood) return;
      this.mood = mood;
      this.target = Object.assign({}, DEFAULT, MOODS[mood]);
      // Discrete properties switch immediately; numbers glide in update().
      this.p.arms = this.target.arms;
      this.p.closed = this.target.closed;
      this.p.gazeStyle = this.target.gazeStyle;
      this.nextSaccade = 0;
      this.jiggle(mood === "angry" ? 1 : 0.55);
    }

    setTalkSource(fn) { this.talkSource = fn; }

    jiggle(strength = 1) {
      if (reduceMotion) strength *= 0.3;
      this.off.forEach((_, i) => {
        const [x, y] = BASE[i];
        const len = Math.hypot(x, y - CENTER_Y) || 1;
        const k = strength * 70 * (0.7 + Math.random() * 0.6) * (i % 2 ? 1 : -0.6);
        this.vel[i][0] += (x / len) * k;
        this.vel[i][1] += ((y - CENTER_Y) / len) * k;
      });
      this.sq.vx += strength * 0.9;
      this.sq.vy -= strength * 0.9;
    }

    poke() {
      this.jiggle(1.4);
      this.sq.vy -= 1.6;
      this.sq.vx += 1.2;
      this.squintUntil = performance.now() + 380;
      if (this.opts.onPoke) this.opts.onPoke(this);
    }

    // ---------- per-frame ----------
    update(dt, t, nowMs) {
      const p = this.p, T = this.target;
      const ease = 1 - Math.exp(-dt * 10);
      NUMERIC.forEach((k) => { p[k] = lerp(p[k], T[k], ease); });

      // Talking level. While speaking (with a short hold to bridge gaps
      // between syllables) the mouth is driven purely by the voice: no
      // resting open mouth, no teeth, no tongue sticking out.
      const lvl = this.talkSource ? clamp(this.talkSource() || 0) : 0;
      this.talk = lerp(this.talk, lvl, clamp(dt * 30));
      if (lvl > 0.05) this.lastTalkAt = nowMs;
      const speaking = nowMs - (this.lastTalkAt || -1e9) < 300 ? 1 : 0;
      this.speakK = lerp(this.speakK || 0, speaking, clamp(dt * 12));

      // Squash & stretch springs toward the mood's body shape
      const sq = this.sq, K = 150, C = 11;
      sq.vx += (K * (T.sx - sq.x) - C * sq.vx) * dt;
      sq.vy += (K * (T.sy - sq.y) - C * sq.vy) * dt;
      sq.x += sq.vx * dt;
      sq.y += sq.vy * dt;
      const breathRate = this.mood === "sleepy" ? 0.45 : 0.32;
      const breath = Math.sin(t * Math.PI * 2 * breathRate);
      const SX = sq.x * (1 - 0.012 * breath - 0.015 * this.talk);
      const SY = sq.y * (1 + 0.022 * breath + 0.05 * this.talk);

      // Jelly springs on every outline point
      for (let i = 0; i < BASE.length; i++) {
        const o = this.off[i], v = this.vel[i];
        v[0] += (-230 * o[0] - 9 * v[0]) * dt;
        v[1] += (-230 * o[1] - 9 * v[1]) * dt;
        o[0] += v[0] * dt;
        o[1] += v[1] * dt;
      }
      const pts = BASE.map(([x, y], i) => [x * SX + this.off[i][0], Math.min(y * SY + this.off[i][1], 4)]);

      // Whole-body motion: happy hop, angry tremble
      const hop = p.hop * Math.max(0, Math.sin(t * 7)) * 7 * (reduceMotion ? 0.2 : 1);
      const shake = p.red > 0.4 && !reduceMotion ? (Math.random() - 0.5) * 2.4 * p.red : 0;
      this.root.setAttribute("transform", `translate(${f(shake)},${f(-hop)})`);
      set(this.shadow, { rx: f(70 * SX * (1 - hop / 40)), opacity: f(1 - hop / 25) });

      // Body
      const bodyD = smooth(pts);
      this.o.body.setAttribute("d", bodyD);
      this.fl.body.setAttribute("d", bodyD);

      // Feet
      [["footL", -38], ["footR", 38]].forEach(([k, x]) => {
        const at = { cx: f(x * SX), cy: 1 };
        set(this.o[k], at); set(this.fl[k], at);
      });

      // Arms: noodle curves from shoulder to mitten hands
      const pose = POSES[p.arms] || POSES.rest;
      const handEase = 1 - Math.exp(-dt * 9);
      ["L", "R"].forEach((side) => {
        const s = side === "L" ? -1 : 1;
        let [tx, ty] = pose[side];
        if (p.arms === "wave" && side === "R") { tx += Math.sin(t * 9) * 10; ty += Math.cos(t * 9) * 4; }
        ty -= this.talk * 12 * Math.max(0, Math.sin(t * 8 + (s > 0 ? 0 : 1.7)));
        const h = this.hands[side];
        h[0] = lerp(h[0], tx * (0.5 + SX * 0.5), handEase);
        h[1] = lerp(h[1], ty, handEase);
        const sxp = s * 64 * SX + this.off[s > 0 ? 3 : 9][0], syp = -50 * SY;
        const mx = (sxp + h[0]) / 2, my = (syp + h[1]) / 2;
        let nx = -(h[1] - syp), ny = h[0] - sxp;
        const nl = Math.hypot(nx, ny) || 1;
        nx /= nl; ny /= nl;
        if (Math.sign(nx) !== s) { nx = -nx; ny = -ny; }
        const d = `M${f(sxp)},${f(syp)} Q${f(mx + nx * pose.bend)},${f(my + ny * pose.bend)} ${f(h[0])},${f(h[1])}`;
        this.o[`arm${side}`].setAttribute("d", d);
        this.fl[`arm${side}`].setAttribute("d", d);
        const hand = { cx: f(h[0]), cy: f(h[1]) };
        const thumb = { cx: f(h[0] - s * 6), cy: f(h[1] - 6) };
        set(this.o[`hand${side}`], hand); set(this.fl[`hand${side}`], hand);
        set(this.o[`thumb${side}`], thumb); set(this.fl[`thumb${side}`], thumb);
      });

      // Eyes
      this.updateGaze(dt, t, nowMs);
      const blink = this.blinkValue(t);
      const squint = nowMs < this.squintUntil ? 0.75 : 0;
      const lidAmt = clamp(Math.max(p.lid, blink, squint));
      const topOff = [this.off[7], this.off[5]];
      this.eyes.forEach((e, i) => {
        const s = e.s;
        const ex = s * 31 * SX + topOff[i][0];
        const ey = -110 * SY + topOff[i][1] * 0.8;
        const bump = { cx: f(ex), cy: f(ey + 1) };
        set(this.o[s < 0 ? "bumpL" : "bumpR"], bump);
        set(this.fl[s < 0 ? "bumpL" : "bumpR"], bump);
        set(e.clip, { cx: f(ex), cy: f(ey) });
        set(e.white, { cx: f(ex), cy: f(ey) });
        set(e.ring, { cx: f(ex), cy: f(ey) });
        const pr = p.pupil;
        const reach = ER - pr - 3;
        const px = ex + this.gaze.x * reach, py = ey + this.gaze.y * reach * 0.85;
        set(e.pupil, { cx: f(px), cy: f(py), r: f(pr) });
        set(e.shine, { cx: f(px - pr * 0.35), cy: f(py - pr * 0.38), r: f(Math.max(1.2, pr * 0.3)) });

        // Upper lid with an angry inward tilt
        const edgeY = ey - ER + 2 * ER * lidAmt;
        const inner = edgeY + p.tilt, outer = edgeY - p.tilt * 0.3;
        const lx = ex - ER - 4, rx = ex + ER + 4;
        const yL = s > 0 ? inner : outer, yR = s > 0 ? outer : inner;
        e.lid.setAttribute("d", `M${f(lx)},${f(ey - ER - 8)} L${f(rx)},${f(ey - ER - 8)} L${f(rx)},${f(yR)} Q${f(ex)},${f(edgeY + 5)} ${f(lx)},${f(yL)} Z`);
        e.lidLine.setAttribute("d", `M${f(lx)},${f(yL)} Q${f(ex)},${f(edgeY + 5)} ${f(rx)},${f(yR)}`);
        e.lidLine.setAttribute("opacity", lidAmt > 0.03 && lidAmt < 0.9 ? 1 : 0);

        // Fully closed: happy ^ ^ or sleepy u u
        const closedK = clamp((lidAmt - 0.85) / 0.12);
        const happy = p.closed === "happy" && blink < 0.5;
        e.arc.setAttribute("d", happy
          ? `M${f(ex - 11)},${f(ey + 4)} Q${f(ex)},${f(ey - 9)} ${f(ex + 11)},${f(ey + 4)}`
          : `M${f(ex - 11)},${f(ey)} Q${f(ex)},${f(ey + 8)} ${f(ex + 11)},${f(ey)}`);
        e.arc.setAttribute("opacity", f(closedK));

        // Brows: -1 angry (inner end low), +1 raised in surprise
        const b = p.brow, top = ey - ER - 7;
        const innerX = ex - s * 8, outerX = ex + s * 16;
        const yIn = top + (b < 0 ? 9 * -b : -6 * b), yOut = top + (b < 0 ? -3 * -b : -4 * b);
        e.brow.setAttribute("d", `M${f(outerX)},${f(yOut)} Q${f((innerX + outerX) / 2)},${f(Math.min(yIn, yOut) - 4 * Math.max(0, b))} ${f(innerX)},${f(yIn)}`);
        e.brow.setAttribute("opacity", f(clamp(Math.abs(b) * 1.6)));
      });

      // Cheeks (pink when happy, red when angry)
      this.cheeks.forEach((c, i) => {
        const s = i ? 1 : -1;
        set(c, {
          cx: f(s * 50 * SX), cy: f(-66 * SY),
          rx: f(10 + p.red * 4), fill: mixColor(PINK, RED, p.red),
          opacity: f(Math.max(p.blush, p.red * 0.75) * 0.6),
        });
      });

      // Mouth: one shape that morphs between line, smile, O, grin
      const sk = this.speakK;
      const open = clamp(lerp(p.mo, this.talk * 0.85, sk));
      const teeth = p.teeth > 0.5 && sk < 0.5;
      const mw = lerp(p.mw, Math.min(p.mw, 34), sk) * SX;      // big grin narrows a bit to talk
      const my = MOUTH_Y * SY, c = p.mc, op = open * 26;
      const lx = -mw / 2, rx = mw / 2, ly = my, ry = my - p.skew;
      const mouthD = `M${f(lx)},${f(ly)} Q0,${f(my + c)} ${f(rx)},${f(ry)} Q0,${f(my + c + op * 1.9)} ${f(lx)},${f(ly)} Z`;
      set(this.mouth, { d: mouthD, fill: teeth ? "#fff" : INK });
      this.mouthClip.setAttribute("d", mouthD);
      set(this.tongueIn, { cx: 0, cy: f(my + c / 2 + op * 0.8), rx: f(mw * 0.28), ry: f(op * 0.38), opacity: teeth ? 0 : 1 });
      this.teethLine.setAttribute("d", `M${f(lx + 4)},${f(ly + op * 0.25)} Q0,${f(my + c + op * 0.55)} ${f(rx - 4)},${f(ry + op * 0.25)}`);
      this.teethLine.setAttribute("opacity", teeth && op > 3 ? 1 : 0);
      const tg = p.tongue * (1 - sk), yb = my + c / 2 + op * 0.9;
      this.tongueOut.setAttribute("d", `M-9,${f(yb - 2)} Q-10,${f(yb + 20 * tg)} 1,${f(yb + 20 * tg)} Q12,${f(yb + 20 * tg)} 10,${f(yb - 2)} Z`);
      this.tongueOut.setAttribute("opacity", tg > 0.08 ? 1 : 0);

      // Extras: sweat drop, floating z's
      const sw = p.sweat;
      const sy0 = -96 * SY + Math.sin(t * 3) * 2;
      this.sweat.setAttribute("d", `M${f(70 * SX)},${f(sy0)} Q${f(64 * SX)},${f(sy0 + 12)} ${f(70 * SX)},${f(sy0 + 15)} Q${f(76 * SX)},${f(sy0 + 12)} ${f(70 * SX)},${f(sy0)} Z`);
      this.sweat.setAttribute("opacity", f(sw));
      this.zzz.forEach((z, i) => {
        const ph = (t * 0.35 + i * 0.5) % 1;
        set(z, { x: f(62 + i * 16 + ph * 8), y: f(-120 - i * 14 - ph * 26), opacity: f(p.zzz * Math.sin(ph * Math.PI)) });
      });
    }

    blinkValue(t) {
      if (t > this.nextBlink) {
        this.blinkAt = t;
        this.nextBlink = t + (Math.random() < 0.2 ? 0.28 : 2.4 + Math.random() * 3.6);
      }
      const ph = t - this.blinkAt;
      if (ph < 0.07) return ph / 0.07;
      if (ph < 0.17) return 1 - (ph - 0.07) / 0.1;
      return 0;
    }

    updateGaze(dt, t, nowMs) {
      const style = this.p.gazeStyle;
      if (nowMs - pointer.at < 2500 && style !== "fixed") {
        // Follow the cursor / finger
        const r = this.svg.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height * 0.35;
        let dx = (pointer.x - cx) / (r.width * 0.9), dy = (pointer.y - cy) / (r.height * 0.9);
        const m = Math.hypot(dx, dy);
        if (m > 1) { dx /= m; dy /= m; }
        this.gazeT = { x: dx, y: dy };
      } else if (nowMs - tilt.at < 1000 && Math.hypot(tilt.x, tilt.y) > 1.5 && style !== "fixed") {
        // Phone tilted: eyes roll downhill
        this.gazeT = { x: clamp(-tilt.x / 6, -1, 1), y: clamp(tilt.y / 6, -1, 1) };
      } else if (t > this.nextSaccade) {
        // Look around on its own
        const r = Math.random();
        if (style === "fixed") this.gazeT = { x: 0, y: 0.1 };
        else if (style === "lazy") this.gazeT = { x: (Math.random() - 0.5) * 1.2, y: 0.4 + Math.random() * 0.4 };
        else if (style === "suspicious") this.gazeT = r < 0.6 ? { x: 0.75, y: 0.55 } : r < 0.85 ? { x: 0, y: 0 } : { x: -0.7, y: 0.3 };
        else this.gazeT = r < 0.35 ? { x: 0, y: 0 } : { x: (Math.random() - 0.5) * 1.6, y: (Math.random() - 0.5) * 1.1 };
        this.nextSaccade = t + (style === "lazy" ? 2.8 + Math.random() * 2.5 : 1 + Math.random() * 2.6);
      }
      const k = clamp(dt * (style === "lazy" ? 6 : 18));
      this.gaze.x = lerp(this.gaze.x, this.gazeT.x, k);
      this.gaze.y = lerp(this.gaze.y, this.gazeT.y, k);
    }
  }

  return Object.assign(GloopChar, { moods: Object.keys(MOODS) });
})();
