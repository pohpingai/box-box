// ui-voice.js — the race engineer on Team A's radio.
// Each of Team A's calls plays a matching voice line (made once with
// ElevenLabs, saved in audio/v-*.mp3), squeezed through a "radio" filter
// with a short crackle before and after, like real team radio.
//
// To avoid a wall of "Stay out" every lap, a line only plays when Team A's
// call CHANGES (a pit stop always plays). If the engineer is still talking,
// a new ordinary line is skipped (and tried again next lap); important ones (pit stop, safety car,
// finish) wait their turn.

// Which mp3 files go with which call. NORMAL and SAVE have no line (on purpose).
const LINES = {
  STAY: ["v-stay"], PUSH: ["v-push"],
  BOX_SOFT: ["v-box", "v-softs"], BOX_MEDIUM: ["v-box", "v-mediums"], BOX_HARD: ["v-box", "v-hards"],
};

export function makeVoice(audio) {
  let radio = null;        // the radio filter chain (made on first use)
  let busy = false, queue = [], lastCall = null; // queue = important lines waiting their turn

  // Phone-call sound: cut the deep and the very high parts, add a little grit.
  function chain() {
    if (radio) return radio;
    const ctx = audio.ctx();
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 450;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3200;
    const grit = ctx.createWaveShaper(); grit.curve = softClip(6);
    const out = ctx.createGain(); out.gain.value = 1.1;
    hp.connect(lp).connect(grit).connect(out).connect(audio.master());
    return (radio = hp);
  }

  // A short burst of static, like the radio button being pressed.
  function crackle(seconds = 0.12) {
    const ctx = audio.ctx();
    const n = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const pop = Math.random() < 0.02 ? 1 : 0.35; // a few louder pops
      d[i] = (Math.random() * 2 - 1) * pop * (1 - i / n);
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = 0.25;
    src.connect(g).connect(chain());
    src.start();
    return new Promise((done) => (src.onended = done));
  }

  // Play a list of lines as one radio message: crackle, lines, crackle.
  // Returns false if it was skipped because the engineer was still talking.
  function say(names, important = false) {
    if (!audio.ctx() || !names.length) return true;
    if (busy) { if (important && queue.length < 3) queue.push(names); return important; }
    busy = true;
    speak(names);
    return true;
  }
  async function speak(names) {
    try {
      await Promise.all(names.map((n) => audio.load(n))); // so there are no gaps
      await crackle();
      for (const n of names) await audio.play(n, { out: chain() });
      await crackle(0.08);
    } catch (e) { console.warn("voice line failed:", e); }
    busy = false;
    if (queue.length) say(queue.shift(), true);
  }

  return {
    reset() { lastCall = null; queue = []; },
    // Team A made a call this lap.
    call(call) {
      const lines = LINES[call] || [];
      const isBox = call.startsWith("BOX_");
      if (call === lastCall && !isBox) return;
      // Only remember it if it was really said, so a skipped line is tried next lap.
      if (say(lines, isBox)) lastCall = call;
    },
    safetyCar() { say(["v-sc"], true); },
    finish(teamAWon) { say([teamAWon ? "v-p1" : "v-p2"], true); },
  };
}

// A gentle distortion curve (k = how much grit).
function softClip(k) {
  const c = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const x = (i / 255) * 2 - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
  return c;
}
