// ui-audio.js — the "sound desk": background music, the finish sting, and the
// master volume / mute. Uses the browser's Web Audio API (a little mixing desk
// built into every browser). All sounds are mp3 files in audio/, made ONCE with
// ElevenLabs — the page never calls ElevenLabs, so there's no key and no cost.
//
// Phones only allow sound after a tap, so unlock() is called from RUN RACE.
// If anything fails (old browser, file missing) the page stays silent and the
// race works exactly as before.

const VOL_KEY = "boxbox-volume", MUTE_KEY = "boxbox-mute";
const FADE = 1.2; // seconds to cross-fade between the two music loops

export function makeAudio() {
  let ctx = null, master = null, musicBus = null;
  const buffers = {};            // name → decoded sound
  let loops = {};                // "race"/"tension" → { src, gain } while playing
  let current = null;            // which loop is audible
  let volume = +(localStorage.getItem(VOL_KEY) ?? 0.7);
  let muted = localStorage.getItem(MUTE_KEY) === "on";

  // Called from a tap (RUN RACE). Creates the mixing desk the first time.
  function unlock() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
        master = ctx.createGain();
        master.connect(ctx.destination);
        musicBus = ctx.createGain();
        musicBus.gain.value = 0.55; // music sits under the voice
        musicBus.connect(master);
        applyVolume();
      }
      if (ctx.state === "suspended") ctx.resume();
      return true;
    } catch (e) { console.warn("audio off:", e); return false; }
  }

  // Fetch + decode a file once, then reuse it. Returns null on failure.
  async function load(name) {
    if (!ctx) return null;
    if (!(name in buffers)) {
      buffers[name] = fetch(`audio/${name}.mp3`)
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then((b) => new Promise((ok, bad) => ctx.decodeAudioData(b, ok, bad)))
        .catch((e) => { console.warn(`audio/${name}.mp3 failed:`, e); return null; });
    }
    return buffers[name];
  }

  // Play a sound once through `out` (default: master). Returns when it's over.
  async function play(name, { out = master, rate = 1 } = {}) {
    const buf = await load(name);
    if (!buf) return 0;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    src.connect(out);
    src.start();
    return new Promise((done) => (src.onended = () => done(buf.duration)));
  }

  // Music: "race" (calm loop) or "tension" (safety car loop). Cross-fades.
  async function music(which) {
    if (!ctx || current === which) return;
    current = which;
    const buf = await load(`${which}-loop`);
    if (!buf || current !== which) return; // file failed, or switched again meanwhile
    const t = ctx.currentTime;
    for (const [name, l] of Object.entries(loops)) { // fade out the other loop
      l.gain.gain.setTargetAtTime(0, t, FADE / 3);
      l.src.stop(t + FADE * 2);
      delete loops[name];
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + FADE);
    gain.connect(musicBus);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true; // the files were made to loop without a seam
    src.connect(gain);
    src.start();
    loops[which] = { src, gain };
  }

  // Fade all music out (end of race), then play the finish sting.
  function stopMusic(fade = 0.8) {
    current = null;
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const l of Object.values(loops)) { l.gain.gain.setTargetAtTime(0, t, fade / 3); l.src.stop(t + fade * 2); }
    loops = {};
  }
  async function finishSting() {
    stopMusic();
    return play("finish", { out: musicBus });
  }

  function applyVolume() {
    if (master) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.05);
  }

  return {
    unlock, load, play, music, stopMusic, finishSting,
    ctx: () => ctx, master: () => master,
    setVolume(v) { volume = v; localStorage.setItem(VOL_KEY, v); applyVolume(); },
    setMuted(m) { muted = m; localStorage.setItem(MUTE_KEY, m ? "on" : "off"); applyVolume(); },
    volume: () => volume, muted: () => muted,
  };
}
