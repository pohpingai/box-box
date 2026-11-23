// ui-voice.js — the two race engineers on the radio.
// Team A's engineer (calm British, driver "Alex") and Team B's engineer
// (energetic Australian, driver "Blake"). Every line starts with the driver's
// name, e.g. "Alex, box box. Mediums." Lines were made once with ElevenLabs
// and saved as audio/a-*.mp3 and audio/b-*.mp3.
//
// The radio effect is light on purpose (voices must stay clear): it only trims
// the deepest and the very highest sounds, with a soft click of static before
// and after.
//
// One radio channel, one voice at a time. To avoid "Stay out" every lap, a
// team's line only plays when its call CHANGES (pit stops always play). If
// someone is still talking, an ordinary line is skipped (tried again next
// lap); important ones (pit stop, safety car, finish) wait in a short queue.
//
// onSpeak(team, key) is called when a line starts (team = "A"/"B", key = the
// radio line it belongs to) and onSpeak(null) when the channel goes quiet, so
// the page can make the speaking team glow.

// Which file goes with which call. NORMAL and SAVE have no line (on purpose).
const FILES = { STAY: "stay", PUSH: "push", BOX_SOFT: "box-soft", BOX_MEDIUM: "box-medium", BOX_HARD: "box-hard" };

export function makeVoice(audio, onSpeak = () => {}) {
  let radio = null;
  let busy = false, queue = [];
  const lastCall = { A: null, B: null };

  // Light radio colour: cut the rumble and the hiss, keep every word crisp.
  function chain() {
    if (radio) return radio;
    const ctx = audio.ctx();
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 180;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 7500; lp.Q.value = 0.5;
    const presence = ctx.createBiquadFilter(); presence.type = "peaking"; // a touch of "radio" brightness
    presence.frequency.value = 2200; presence.gain.value = 3; presence.Q.value = 0.8;
    hp.connect(lp); lp.connect(presence); presence.connect(audio.master());
    return (radio = hp);
  }

  // A soft click of static, like the radio button being pressed.
  function crackle(seconds) {
    const ctx = audio.ctx();
    const n = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = 0.06;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2500;
    src.connect(bp); bp.connect(g); g.connect(audio.master());
    src.start();
    return new Promise((done) => (src.onended = done));
  }

  // msg = { team, file, key }. Returns false if skipped (channel busy).
  function say(msg, important = false) {
    if (!audio.ctx()) return true;
    if (busy) { if (important && queue.length < 4) queue.push(msg); return important; }
    busy = true;
    speak(msg);
    return true;
  }
  async function speak({ team, file, key }) {
    try {
      const name = `${team.toLowerCase()}-${file}`;
      await audio.load(name); // so there's no gap after the click
      await crackle(0.07);
      onSpeak(team, key);
      await audio.play(name, { out: chain() });
      await crackle(0.05);
    } catch (e) { console.warn("voice line failed:", e); }
    busy = false;
    if (queue.length) say(queue.shift(), true);
    else onSpeak(null);
  }

  return {
    reset() { lastCall.A = lastCall.B = null; queue = []; },
    // A team made a call this lap. key = which radio line to light up.
    call(team, call, key) {
      const file = FILES[call];
      if (!file) return;
      const isBox = call.startsWith("BOX_");
      if (call === lastCall[team] && !isBox) return;
      if (say({ team, file, key }, isBox)) lastCall[team] = call;
    },
    safetyCar() { for (const team of ["A", "B"]) say({ team, file: "sc" }, true); },
    // Winner's engineer first, then the other team's.
    finish(winner) {
      const loser = winner === "A" ? "B" : "A";
      say({ team: winner, file: "p1" }, true);
      say({ team: loser, file: "p2" }, true);
    },
    // "🎧 Voice test": one line from each team.
    test() { say({ team: "A", file: "box-medium" }, true); say({ team: "B", file: "push" }, true); },
  };
}
