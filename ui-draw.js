// ui-draw.js — draws one moment ("frame") of the race, and the radio feed.

import { callToWords } from "./race.js";

const $ = (id) => document.getElementById(id);

export function drawFrame(f) {
  $("lap").textContent = f.lap;
  $("flags").innerHTML = (f.safetyCar ? '<span class="flag-sc">SAFETY CAR</span>' : "") +
                         (f.rain ? '<span class="flag-rain">RAIN</span>' : "");
  drawTower(f.cars);
  drawTrack(f.cars);
}

function drawTower(cars) {
  const lead = cars[0].time;
  $("tower").innerHTML = cars.map((c, i) => {
    const t = c.team.toLowerCase();
    const col = c.tyre > 60 ? "#3ddc84" : c.tyre > 30 ? "#ffd400" : "#ff3b3b";
    return `<div class="pos ${t}">
      <div class="p">P${i + 1}</div>
      <div class="info">
        <div class="line1"><b>Team ${c.team}</b>
          <span class="badge ${c.compound}">${c.compound[0].toUpperCase()}</span>
          <span>${Math.round(c.tyre)}%</span>
          <span class="mode ${c.mode}">${c.mode}</span>
          <span class="muted">${c.stops} stop</span></div>
        <div class="bar"><i style="width:${c.tyre}%;background:${col}"></i></div>
      </div>
      <div class="gap">${i === 0 ? "Leader" : "+" + (c.time - lead).toFixed(1) + "s"}</div>
    </div>`;
  }).join("");
}

// Leader on the right; the chaser sits back by its gap (30s = whole strip).
function drawTrack(cars) {
  const [p1, p2] = cars;
  const gap = Math.min(p2.time - p1.time, 30);
  $("car" + p1.team).style.left = "calc(100% - 30px)";
  // min() keeps the two dots from sitting on top of each other.
  $("car" + p2.team).style.left = `min(calc(${(1 - gap / 30) * 100}% - 30px), calc(100% - 58px))`;
}

// ---------- Radio ----------
// Every message is kept with its lap number, so the replay slider can
// show the radio exactly as it was at any lap.
export function makeRadio() {
  let items = [];
  return {
    clear() { items = []; render(0); },
    add(lap, html, cls = "") { items.push({ lap, html, cls }); },
    render,
  };
  function render(upToLap) {
    const shown = items.filter((m) => m.lap <= upToLap).reverse(); // newest on top
    $("feed").innerHTML = shown.length
      ? shown.map((m) => `<li class="${m.cls}">${m.html}</li>`).join("")
      : '<li class="muted">Press RUN RACE to start.</li>';
  }
}

// "Lap 20 · A (told: P1, +0.23s ahead): Push now. Reason: …"
// "told" = exactly what the team's brain was sent at the START of the lap.
export function callLine(e) {
  const { position, gapToRival: g } = e.state;
  const ahead = position === "P1";
  const size = Math.abs(g) < 0.01 ? "<0.01s" : `${Math.abs(g).toFixed(2)}s`;
  const where = ahead ? `+${size} ahead` : `${size} behind`;
  const fb = e.brain === "fallback";
  const reason = esc(fb ? e.reason.replace(" (fallback)", "") : e.reason);
  return `Lap ${e.lap} · <span class="t${e.team.toLowerCase()}">${e.team}</span> ` +
    `<span class="why">(told: ${position}, ${where})</span>: ${callToWords(e.call)}. ` +
    `<span class="why">Reason: ${reason}</span>` +
    (fb ? ` <span class="fb">(fallback)</span> <span class="why">· ${esc(e.why)}</span>` : "") +
    simLine(e.sims);
}

// "🔧 tested: box_hard now → 2.10s behind · stay_out, box_hard on lap 8 → 1.00s ahead"
function simLine(sims) {
  if (!sims?.length) return "";
  const parts = sims.map((x) => `${esc(x.plan)} → ${x.finishGap <= 0 ? `${Math.abs(x.finishGap).toFixed(2)}s ahead` : `${x.finishGap.toFixed(2)}s behind`}`);
  return `<div class="sim">🔧 tested: ${parts.join(" · ")}</div>`;
}

export function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
