// ui-stage.js — connects the race page to the 3D Las Vegas view (three/view.js).
// The 3D view loads in the background. If it can't start (an old phone with
// no 3D graphics, or a file fails to load) the race still works: the page
// keeps the simple flat strip, and the 3D box says WHY in plain words, so a
// problem on someone's phone is never invisible.

export function makeStage(host, player) {
  let view = null, last = null;

  start().catch((e) => {
    console.warn("3D view off:", e);
    host.classList.add("failed");
    const msg = document.createElement("p");
    msg.className = "stage-error";
    msg.textContent = `The 3D view couldn't start on this browser (${e?.message || e}). ` +
      "The race still works below. Updating the phone's browser usually fixes it.";
    host.append(msg);
  });

  async function start() {
    if (!webglWorks()) throw new Error("no 3D graphics (WebGL) available");
    const { makeView } = await import("./three/view.js");
    view = makeView(host, { getMsPerLap: player.msPerLap, isPaused: player.isPaused });
    document.body.classList.add("has-3d");
    if (last) view.setFrame(last, false);
  }

  return {
    // A lap finished (animate=true), or the replay slider / start (animate=false).
    frame(f, animate = true) {
      last = f;
      view?.setFrame(f, animate);
    },
    // Make a team's car glow while its engineer is talking (null = nobody).
    speaking(team) { view?.speaking(team); },
    // "sc", "box" or "overtake", for team "A" or "B".
    moment(kind, team) {
      view?.moment(kind, team); // (skipped if the 3D view isn't ready yet)
    },
  };
}

// Can this browser draw 3D at all? (Some old phones, or phones in power-saving
// modes, can't.)
function webglWorks() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
