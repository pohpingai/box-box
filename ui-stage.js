// ui-stage.js — connects the race page to the 3D Las Vegas view (three/view.js).
// The 3D view loads in the background. If it can't start (an old phone with
// no 3D graphics, or a file fails to load) the race still works: the page just
// keeps the simple flat strip instead.

export function makeStage(host, player) {
  let view = null, last = null;

  import("./three/view.js")
    .then(({ makeView }) => {
      view = makeView(host, { getMsPerLap: player.msPerLap, isPaused: player.isPaused });
      document.body.classList.add("has-3d");
      if (last) view.setFrame(last, false);
    })
    .catch((e) => {
      console.warn("3D view off:", e);
      host.classList.add("hidden");
    });

  return {
    // A lap finished (animate=true), or the replay slider / start (animate=false).
    frame(f, animate = true) {
      last = f;
      view?.setFrame(f, animate);
    },
    // "sc", "box" or "overtake", for team "A" or "B".
    moment(kind, team) {
      view?.moment(kind, team); // (skipped if the 3D view isn't ready yet)
    },
  };
}
