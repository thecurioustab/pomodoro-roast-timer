// Everything Gloop says.
//
// Voiced lines (roasts, return roasts, verdicts, break-over) get a real AI
// voice clip — see tools/generate-voice.mjs. They may only use the {task}
// placeholder, which the clip says as "your work". Everything else is babbled.

window.ROASTS = {
  mild: {
    first: [
      "Hey! The phone was doing just fine without you. Back to {task}.",
      "Ribbit. That's frog for: put it down, buddy.",
      "Tiny slip. No judgement. Okay… a little judgement.",
      "Aww, you missed your phone? It didn't miss you. Back to work.",
    ],
    repeat: [
      "Again? Your phone isn't going anywhere. Neither is {task}.",
      "We talked about this. Phone down, brain on.",
      "The notifications will survive without you. I promise.",
    ],
    many: [
      "Okay, friend. Maybe put the phone in another room?",
      "Your focus is buffering. Deep breath. Let's try again.",
    ],
  },
  spicy: {
    first: [
      "Oh, we're scrolling now? {task} isn't going to do itself.",
      "Put it down. Nobody texted you. Nobody ever texts you.",
      "Breaking news: local genius picks up phone instead of doing {task}.",
      "Wow. Olympic-level focus. Gold medal in giving up.",
      "I'm a frog, and even I have a longer attention span. I eat flies.",
    ],
    repeat: [
      "Your attention span called. It wants a refund.",
      "Again? Your thumb has a gym membership at this point.",
      "Your phone should honestly start paying you rent.",
      "Even goldfish are side-eyeing you right now.",
      "Is the phone doing {task} for you? No? Then put it DOWN.",
    ],
    many: [
      "At this point, just marry the phone. I'll officiate.",
      "You're not multitasking. You're just tasking… badly.",
      "Future you is writing a very angry letter to present you.",
      "Your screen time report is going to need therapy.",
    ],
  },
  savage: {
    first: [
      "Folded already? Incredible. Truly. Hall of fame.",
      "You grabbed that phone like it owed you money. It doesn't. You owe {task}.",
      "Scrolling won't make {task} disappear. I checked.",
      "The algorithm thanks you for your service. Your grades do not.",
      "I've seen tadpoles with more discipline. Tadpoles!",
    ],
    repeat: [
      "Your phone has more willpower than you. And it's a rectangle.",
      "I'd roast your focus, but there's nothing left to burn.",
      "The only thing you're finishing today is your battery.",
      "Your to-do list just filed a missing persons report.",
      "A procrastination coach is taking notes on you. As a warning.",
    ],
    many: [
      "Let's rename this session: phone time, with light studying.",
      "At this rate, {task} will be finished by your grandkids.",
      "Even the timer is embarrassed to be seen with you.",
      "I'm not mad. I'm just disappointed. Okay. I'm also mad.",
    ],
  },
};

// When they come back after switching to another app.
window.RETURN_ROASTS = [
  "Oh, welcome back! Hope that reel was worth it.",
  "And where did we go? Be honest. Was it urgent?",
  "Ah, you're back. {task} kept your seat warm.",
  "Speedrunning distraction, are we? Welcome back.",
];

// End-of-session verdicts by grade.
window.VERDICTS = {
  S: ["Zero pickups?! Who ARE you? Absolute monk mode.", "Flawless. Your phone is filing for loneliness."],
  A: ["Solid session. One or two slips, but you held the line.", "Nice. Your phone barely got a word in."],
  B: ["Not bad, not great. Your phone made a few cameo appearances.", "Decent! Room to improve, but you showed up."],
  C: ["Your phone was basically your study buddy today.", "Half focus, half scroll. A true hybrid."],
  D: ["That wasn't a focus session. That was a phone session with breaks.", "Your phone won this round. Rematch?"],
};

// Everyday chatter — babbled, not voiced.
window.LINES = {
  ready: [
    "Hi, I'm Gloop. Put your phone down flat and press play.",
    "Ready when you are. Phone face down, please.",
    "I'll be watching that phone. Closely. Press play.",
  ],
  start: [
    "Timer's on. I'm watching. 👀",
    "Okay, go. Don't make me come over there.",
    "Focus mode. Your phone and I are having a staring contest.",
  ],
  watch: [
    "Still watching…",
    "Nice. Keep that phone right where it is.",
    "I see you working. I'm almost proud.",
    "Your phone is lonely. Good.",
    "Don't even think about it.",
    "Brain on, phone off. Love that for you.",
  ],
  pause: [
    "Pausing? Suspicious.",
    "Paused. I'm keeping one eye open.",
    "A pause, huh. Sure. Totally not for the phone.",
  ],
  reset: [
    "Reset? Running away, I see.",
    "Fresh start. Let's pretend that didn't happen.",
  ],
  afterRoast: [
    "Good. Now stay down there.",
    "That's better. I'm still watching.",
    "Fine. Back to {task}.",
  ],
  break: [
    "Break time! Scroll guilt-free. I'm napping.",
    "You earned this. Stretch, drink water, ignore me.",
    "Break mode. Phone is legal now. For now.",
  ],
  // Voiced
  breakOver: [
    "Break's over! Phone down, back to {task}.",
    "Nap's done. Let's go another round.",
  ],
  // Voiced: the "Hear Gloop" button in Settings
  test: [
    "Hi, I'm Gloop. I'm friendly. Until you touch that phone.",
  ],
};

// Stable id for a line template -> audio/<id>.mp3 (FNV-1a hash).
window.gloopId = (text) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
};

// The core set that gets an AI voice by default (keeps credits low).
// The app prefers these lines when their clips exist.
{
  const R = window.ROASTS, V = window.VERDICTS;
  window.CORE_VOICE = new Set([
    // 18 roasts: 2 Mild, 8 Spicy, 8 Savage
    R.mild.first[0],    // Hey! The phone was doing just fine without you…
    R.mild.repeat[1],   // We talked about this. Phone down, brain on.
    R.spicy.first[0],   // Oh, we're scrolling now? {task} isn't going to do itself.
    R.spicy.first[1],   // Put it down. Nobody texted you…
    R.spicy.first[4],   // I'm a frog, and even I have a longer attention span…
    R.spicy.repeat[0],  // Your attention span called. It wants a refund.
    R.spicy.repeat[1],  // Again? Your thumb has a gym membership…
    R.spicy.repeat[3],  // Even goldfish are side-eyeing you right now.
    R.spicy.many[0],    // At this point, just marry the phone…
    R.spicy.many[2],    // Future you is writing a very angry letter…
    R.savage.first[0],  // Folded already? Incredible…
    R.savage.first[3],  // The algorithm thanks you for your service…
    R.savage.first[4],  // I've seen tadpoles with more discipline…
    R.savage.repeat[0], // Your phone has more willpower than you…
    R.savage.repeat[1], // I'd roast your focus, but there's nothing left to burn.
    R.savage.repeat[2], // The only thing you're finishing today is your battery.
    R.savage.many[1],   // At this rate, {task} will be finished by your grandkids.
    R.savage.many[3],   // I'm not mad. I'm just disappointed…
    // basics
    window.RETURN_ROASTS[0], window.RETURN_ROASTS[1],
    V.S[0], V.A[0], V.B[0], V.C[0], V.D[0],
    window.LINES.breakOver[0],
    window.LINES.test[0],
  ]);
}

// Lines that get a real voice clip, with a delivery hint.
// VOICED() = core set only, VOICED(true) = every voiceable line.
window.VOICED = (all = false) => {
  const out = [];
  for (const [level, tiers] of Object.entries(window.ROASTS)) {
    for (const lines of Object.values(tiers)) lines.forEach((text) => out.push({ text, style: level }));
  }
  window.RETURN_ROASTS.forEach((text) => out.push({ text, style: "return" }));
  for (const [grade, lines] of Object.entries(window.VERDICTS)) {
    lines.forEach((text) => out.push({ text, style: "SAB".includes(grade) ? "proud" : "disappointed" }));
  }
  window.LINES.breakOver.forEach((text) => out.push({ text, style: "cheerful" }));
  window.LINES.test.forEach((text) => out.push({ text, style: "spicy" }));
  return all ? out : out.filter((l) => window.CORE_VOICE.has(l.text));
};
