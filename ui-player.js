// ui-player.js — the race clock: how long to wait between laps.
// Speeds, Pause/Play and "Next lap". The race loop calls waitForNextLap()
// after each lap; it returns when it's time to run the next one.

export const SPEEDS = { slow: 4000, normal: 2000, fast: 500 }; // ms per lap

export function makePlayer() {
  let msPerLap = SPEEDS.slow;
  let paused = false;
  let stepOnce = false;
  let wake = null; // resolves the current wait early (speed change, play, step)

  function nudge() {
    if (wake) { const w = wake; wake = null; w(); }
  }
  function sleepOrWake(ms) {
    return new Promise((resolve) => {
      const t = setTimeout(() => { wake = null; resolve(); }, ms);
      wake = () => { clearTimeout(t); resolve(); };
    });
  }

  // lapStarted = when the last lap began (Date.now()), so AI thinking time
  // counts towards the wait instead of adding to it.
  async function waitForNextLap(lapStarted) {
    for (;;) {
      if (stepOnce) { stepOnce = false; return; }
      if (paused) { await sleepOrWake(1e9); continue; }
      const left = msPerLap - (Date.now() - lapStarted);
      if (left <= 0) return;
      await sleepOrWake(left);
    }
  }

  return {
    waitForNextLap,
    setSpeed(name) { msPerLap = SPEEDS[name]; nudge(); },
    pause() { paused = true; nudge(); },
    play() { paused = false; nudge(); },
    step() { stepOnce = true; nudge(); },
    reset() { paused = false; stepOnce = false; nudge(); },
    isPaused: () => paused,
  };
}
