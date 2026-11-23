// ui-audio.js — the "sound desk": loads and plays sounds, master volume / mute,
// and the sound effects. Uses the browser's Web Audio API (a little mixing desk
// built into every browser). All sounds are mp3 files in audio/, made ONCE with
// ElevenLabs — the page never calls ElevenLabs, so there's no key and no cost.
// The music itself (3 tracks × 3 intensity levels) is in ui-music.js.
//
// Phones only allow sound after a tap, so unlock() is called from a button.
// If anything fails (old browser, file missing) the page stays silent and the
// race works exactly as before.

const VOL_KEY = "boxbox-volume", MUTE_KEY = "boxbox-mute";

// Sound effects (audio/sfx-*.mp3): pit stop, overtake, safety car, finish.
const SFX = { pit: "sfx-whoosh", overtake: "sfx-overtake", sc: "sfx-alarm", finish: "sfx-crowd" };

export function makeAudio() {
  let ctx = null, master = null, musicBus = null, sfxBus = null;
  const buffers = {};            // name → decoded sound (a Promise)
  let volume = +(localStorage.getItem(VOL_KEY) ?? 0.7);
  let muted = localStorage.getItem(MUTE_KEY) === "on";

  // Called from a tap. Creates the mixing desk the first time.
  function unlock() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
        master = ctx.createGain();
        master.connect(ctx.destination);
        musicBus = ctx.createGain();
        musicBus.gain.value = 0.5; // music sits under the voices
        musicBus.connect(master);
        sfxBus = ctx.createGain();
        sfxBus.gain.value = 0.6;
        sfxBus.connect(master);
        applyVolume();
      }
      if (ctx.state === "suspended") ctx.resume();
      return true;
    } catch (e) { console.warn("audio off:", e); return false; }
  }

  // Fetch + decode a file once, then reuse it. Resolves to null on failure.
  function load(name) {
    if (!ctx) return Promise.resolve(null);
    if (!(name in buffers)) {
      buffers[name] = fetch(`audio/${name}.mp3`)
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then((b) => new Promise((ok, bad) => ctx.decodeAudioData(b, ok, bad)))
        .catch((e) => { console.warn(`audio/${name}.mp3 failed:`, e); return null; });
    }
    return buffers[name];
  }

  // Play a sound once through `out` (default: master). Resolves when it's over.
  async function play(name, { out = master } = {}) {
    const buf = await load(name);
    if (!buf) return 0;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(out);
    src.start();
    return new Promise((done) => (src.onended = () => done(buf.duration)));
  }

  function applyVolume() {
    if (master) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.05);
  }

  return {
    unlock, load, play,
    sfx(kind) { if (ctx && SFX[kind]) play(SFX[kind], { out: sfxBus }); },
    preloadSfx() { Object.values(SFX).forEach(load); },
    ctx: () => ctx, master: () => master, musicBus: () => musicBus,
    setVolume(v) { volume = v; localStorage.setItem(VOL_KEY, v); applyVolume(); },
    setMuted(m) { muted = m; localStorage.setItem(MUTE_KEY, m ? "on" : "off"); applyVolume(); },
    volume: () => volume, muted: () => muted,
  };
}
