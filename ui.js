// ui.js — the Team Boss screen. Runs the race one lap per second and draws it.
import { RULES, createRace, stepLap, standings, result, exportLog, callToWords } from "./race.js";
import * as bot from "./agents/bot.js";

// Which brain each team uses. Later steps swap these for AI agents.
const brains = { A: bot, B: bot };
const LAP_MS = 1000;

const $ = (id) => document.getElementById(id);
let race = null, timer = null;

$("laps").textContent = RULES.laps;
$("startA").textContent = cap(RULES.startCompound.A);
$("startB").textContent = cap(RULES.startCompound.B);
$("dice").onclick = () => ($("seed").value = Math.random().toString(36).slice(2, 7));
$("run").onclick = start;
$("download").onclick = download;
drawTower();

function start() {
  clearInterval(timer);
  const seed = $("seed").value.trim() || "monza";
  race = createRace(seed, { A: brains.A.decide, B: brains.B.decide });
  $("feed").innerHTML = "";
  $("result").classList.add("hidden");
  $("run").disabled = true;
  draw();
  timer = setInterval(tick, LAP_MS);
}

function tick() {
  const newsBefore = race.news.length;
  const events = stepLap(race);
  race.news.slice(newsBefore).forEach((n) => radio(`Lap ${n.lap} · ${n.text}`, "news"));
  events.forEach((e) => radio(
    `Lap ${e.lap} · <span class="t${e.team.toLowerCase()}">${e.team}</span>: ${callToWords(e.call)}. <span class="why">Reason: ${esc(e.reason)}</span>`
  ));
  draw();
  if (race.done) finish();
}

function finish() {
  clearInterval(timer);
  $("run").disabled = false;
  const r = result(race);
  $("resultText").innerHTML = `
    <div class="big">Team ${r.winner} wins by ${r.margin.toFixed(2)}s</div>
    <div>Seed: <b>${esc(race.seed)}</b></div>
    <div>Team A: ${fmt(r.times.A)} · ${r.stops.A} stop(s)</div>
    <div>Team B: ${fmt(r.times.B)} · ${r.stops.B} stop(s)</div>
    <div class="muted">${race.news.length ? race.news.map((n) => esc(n.text)).join(" · ") : "A clean race, no surprises."}</div>`;
  $("result").classList.remove("hidden");
}

function draw() {
  $("lap").textContent = race ? race.lap : 0;
  const lap = race ? race.lap : 0, s = race?.surprises;
  const on = (w) => w && lap >= w.start && lap <= w.end;
  $("flags").innerHTML = (on(s?.safetyCar) ? '<span class="flag-sc">SAFETY CAR</span>' : "") +
                         (on(s?.rain) ? '<span class="flag-rain">RAIN</span>' : "");
  drawTower();
  drawTrack();
}

function drawTower() {
  const cars = race ? standings(race) : ["A", "B"].map((t) => ({ team: t, compound: RULES.startCompound[t], tyre: 100, mode: "normal", time: 0, stops: 0 }));
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
function drawTrack() {
  if (!race) return;
  const [p1, p2] = standings(race);
  const gap = Math.min(p2.time - p1.time, 30);
  $("car" + p1.team).style.left = "calc(100% - 30px)";
  // min() keeps the two dots from sitting on top of each other.
  $("car" + p2.team).style.left = `min(calc(${(1 - gap / 30) * 100}% - 30px), calc(100% - 58px))`;
}

function radio(html, cls = "") {
  const li = document.createElement("li");
  li.className = cls;
  li.innerHTML = html;
  $("feed").prepend(li); // newest on top
}

function download() {
  const log = exportLog(race, { A: brains.A.name, B: brains.B.name });
  const blob = new Blob([JSON.stringify(log, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `boxbox-${race.seed}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function cap(s) { return s[0].toUpperCase() + s.slice(1); }
function fmt(t) { const m = Math.floor(t / 60); return `${m}:${(t - m * 60).toFixed(2).padStart(5, "0")}`; }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
