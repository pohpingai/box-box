// ui-music.js — the race music: 3 tracks to choose from, each in 3 intensity
// levels, all at 135 BPM (beats per minute), made once with ElevenLabs Music.
//
//   Track 1 = dark synthwave · 2 = electronic rock · 3 = cinematic orchestral + synth
//   Levels: "calm" → "building" (gap under 1s) → "climax" (last 3 laps)
//
// Files: audio/m{track}-{level}.mp3. The 3 levels of a track were cut from ONE
// song, on whole bars, so they share key, tempo and instruments. When the level
// (or the track) changes, the new loop starts at the same point in the bar as
// the old one and they cross-fade, so the beat never stumbles.

const TRACK_KEY = "boxbox-music";
export const TRACKS = { 1: "Dark synthwave", 2: "Electronic rock", 3: "Cinematic hybrid" };
const BAR = (4 * 60) / 135; // one bar = 4 beats at 135 BPM ≈ 1.78s
const FADE = 1.5;           // seconds of cross-fade

export function makeMusic(audio) {
  let track = TRACKS[localStorage.getItem(TRACK_KEY)] ? localStorage.getItem(TRACK_KEY) : "1";
  let level = null;   // what should be playing (null = no music)
  let playing = null; // { src, gain, name } of the loop you can hear
  let t0 = 0;         // when the music started (keeps every loop on the same beat)
  let wanted = 0;     // counts requests, so a slow file load can't win over a newer one

  function preload(t = track) { ["calm", "building", "climax"].forEach((l) => audio.load(`m${t}-${l}`)); }

  async function switchTo() {
    const ctx = audio.ctx();
    if (!ctx) return;
    const name = level && `m${track}-${level}`;
    if (playing?.name === name) return;
    const ticket = ++wanted;
    const buf = name ? await audio.load(name) : null;
    if (ticket !== wanted) return; // something newer was asked for meanwhile
    const now = ctx.currentTime;
    if (playing) { // fade out what's playing
      playing.gain.gain.setTargetAtTime(0, now, FADE / 3);
      playing.src.stop(now + FADE * 2);
      playing = null;
    }
    if (!buf) return;
    if (!t0) t0 = now;
    // Loop exactly a whole number of bars (mp3 files carry a few extra
    // milliseconds of padding at the end, which would make the beat slip).
    const loopLen = Math.max(1, Math.round(buf.duration / BAR)) * BAR;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = 0;
    src.loopEnd = loopLen;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + FADE);
    src.connect(gain);
    gain.connect(audio.musicBus());
    src.start(now, (now - t0) % loopLen); // same point in the bar as before
    playing = { src, gain, name };
  }

  return {
    track: () => track,
    level: () => level,
    preload,
    start() { t0 = 0; level = "calm"; preload(); switchTo(); },
    setLevel(l) { if (level && l !== level) { level = l; switchTo(); } },
    setTrack(t) {
      if (!TRACKS[t]) return;
      track = String(t);
      localStorage.setItem(TRACK_KEY, track);
      if (audio.ctx()) preload();
      switchTo();
    },
    stop() { level = null; switchTo(); },
  };
}
