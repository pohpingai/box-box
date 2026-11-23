// ui.js — the Team Boss screen: wires the buttons to the race.
// Team A's AI may take a few seconds per lap: the race waits for it.
// Helpers: ui-player.js (speed/pause), ui-draw.js (drawing), ui-replay.js (lap slider).
import { RULES, createRace, stepLapAsync, result, exportLog } from "./race.js";
import * as bot from "./agents/bot.js";
import { makeStrategist } from "./agents/strategist.js";
import { makePlayer } from "./ui-player.js";
import { drawFrame, makeRadio, callLine, esc } from "./ui-draw.js";
import { makeReplay, frameOf, emptyFrame } from "./ui-replay.js";
import { makeStage } from "./ui-stage.js";
import { makeAudio } from "./ui-audio.js";
import { makeVoice } from "./ui-voice.js";

const PASS_KEY = "boxbox-passcode";
const $ = (id) => document.getElementById(id);
const player = makePlayer();
const radio = makeRadio();
const stage = makeStage(document.getElementById("stage"), player); // 3D Las Vegas view
const audio = makeAudio();      // music + volume (ui-audio.js)
const voice = makeVoice(audio); // Team A's race engineer (ui-voice.js)
let race = null, brains = null, replay = null, running = false;

$("laps").textContent = RULES.laps;
$("startA").textContent = cap(RULES.startCompound.A);
$("startB").textContent = cap(RULES.startCompound.B);
$("dice").onclick = () => ($("seed").value = Math.random().toString(36).slice(2, 7));
$("run").onclick = start;
$("download").onclick = download;
// The simulate() tool switch is also remembered in this browser.
$("simTool").checked = localStorage.getItem("boxbox-sim") !== "off";
$("simTool").onchange = () => localStorage.setItem("boxbox-sim", $("simTool").checked ? "on" : "off");
// The passcode is kept in this browser only (localStorage), never in the code.
$("passcode").value = localStorage.getItem(PASS_KEY) || "";
$("passcode").oninput = () => localStorage.setItem(PASS_KEY, $("passcode").value.trim());

// ---------- Speed, pause, next lap ----------
document.querySelectorAll("[data-speed]").forEach((b) => (b.onclick = () => {
  player.setSpeed(b.dataset.speed);
  document.querySelectorAll("[data-speed]").forEach((x) => x.classList.toggle("on", x === b));
}));
$("pause").onclick = () => (player.isPaused() ? resume() : pauseWith(""));
$("step").onclick = () => { hideBanner(); player.step(); };
$("replay").oninput = () => showLap(+$("replay").value);

// ---------- Sound: mute + volume (remembered in this browser) ----------
$("volume").value = audio.volume();
$("volume").oninput = () => { audio.setVolume(+$("volume").value); if (audio.muted()) toggleMute(); };
$("mute").onclick = toggleMute;
showMute();
function toggleMute() { audio.setMuted(!audio.muted()); showMute(); }
function showMute() {
  $("mute").textContent = audio.muted() ? "🔇" : "🔊";
  $("mute").setAttribute("aria-pressed", audio.muted());
}

drawFrame(emptyFrame());
stage.frame(emptyFrame(), false);
updateButtons();

async function start() {
  const seed = $("seed").value.trim() || "monza";
  // Sound may only start after a tap, so it's switched on here.
  if (audio.unlock()) { voice.reset(); audio.music("race"); }
  const ai = makeStrategist({ passcode: $("passcode").value.trim(), useSim: $("simTool").checked, onThinking });
  brains = { A: ai, B: bot };
  race = createRace(seed, { A: ai.decide, B: bot.decide });
  replay = makeReplay();
  replay.record(race);
  radio.clear();
  hideBanner();
  player.reset();
  $("result").classList.add("hidden");
  $("replayBox").classList.add("hidden");
  running = true;
  updateButtons();
  drawFrame(frameOf(race));
  stage.frame(frameOf(race), false);

  let saidOffline = false;
  while (!race.done) {
    const lapStarted = Date.now();
    const newsBefore = race.news.length;
    const events = await stepLapAsync(race);
    const news = race.news.slice(newsBefore);
    news.forEach((n) => radio.add(n.lap, `Lap ${n.lap} · ${n.text}`, "news"));
    // Say once if the AI is out for the rest of the race (e.g. wrong passcode).
    if (ai.isOffline() && !saidOffline) {
      saidOffline = true;
      radio.add(race.lap, `⚠️ Team A's AI is unavailable (${esc(ai.isOffline())}). The rule bot takes over.`, "news");
    }
    events.forEach((e) => radio.add(e.lap, callLine(e)));
    const newLeader = leadChange(replay.frame(race.lap - 1), frameOf(race));
    replay.record(race);
    drawFrame(frameOf(race));
    stage.frame(frameOf(race));
    bigMoments(news, events, newLeader);
    sounds(news, events);
    radio.render(race.lap);
    if (!race.done) {
      autoPause(news, events);
      await player.waitForNextLap(lapStarted);
    }
  }
  finish();
}

// The calls above were made at the START of the lap. If the order flipped
// DURING the lap, say so, so the radio and the tower never seem to disagree.
// Returns the new leader's team, or null if the order didn't change.
function leadChange(before, after) {
  const was = before.cars[0].team, now = after.cars[0].team;
  if (was === now) return null;
  const gap = (after.cars[1].time - after.cars[0].time).toFixed(2);
  radio.add(after.lap, `Lap ${after.lap} · 🔁 Team ${now} takes P1 during this lap (now ${gap}s ahead of Team ${was})`, "news");
  return now;
}

// Big moments get a glowing word in the 3D view and a short camera close-up.
function bigMoments(news, events, newLeader) {
  if (news.some((n) => /SAFETY CAR deployed/.test(n.text))) stage.moment("sc", frameOf(race).cars[0].team);
  events.filter((e) => e.call.startsWith("BOX_")).forEach((e) => stage.moment("box", e.team));
  if (newLeader) stage.moment("overtake", newLeader);
}

// Music follows the safety car; Team A's engineer reads out Team A's call.
function sounds(news, events) {
  audio.music(frameOf(race).safetyCar ? "tension" : "race");
  if (news.some((n) => /SAFETY CAR deployed/.test(n.text))) voice.safetyCar();
  const a = events.find((e) => e.team === "A");
  if (a) voice.call(a.call);
}

// Stop and explain when something big happens (if the box is ticked).
function autoPause(news, events) {
  if (!$("autoPause").checked) return;
  const big = news.filter((n) => /SAFETY CAR deployed|Rain is falling/.test(n.text)).map((n) => n.text);
  events.filter((e) => e.call.startsWith("BOX_"))
    .forEach((e) => big.push(`🔧 Team ${e.team} pitted for ${cap(e.call.slice(4).toLowerCase())}s`));
  if (big.length) pauseWith(`⏸ Paused after lap ${race.lap}: ${big.join(" · ")}`);
}

function pauseWith(text) {
  player.pause();
  if (text) { $("banner").textContent = text; $("banner").classList.remove("hidden"); }
  updateButtons();
}
function resume() { hideBanner(); player.play(); updateButtons(); }
function hideBanner() { $("banner").classList.add("hidden"); }

function updateButtons() {
  const paused = player.isPaused();
  $("run").disabled = running;
  $("pause").disabled = !running;
  $("pause").textContent = paused ? "▶ Play" : "⏸ Pause";
  $("step").disabled = !running || !paused;
}

function onThinking(on) {
  $("thinkA").textContent = on ? "thinking…" : "ready";
  $("thinkA").classList.toggle("thinking", on);
}

function finish() {
  running = false;
  player.reset();
  hideBanner();
  updateButtons();
  const r = result(race);
  audio.finishSting().then(() => voice.finish(r.winner === "A"));
  const s = brains.A.stats;
  $("resultText").innerHTML = `
    <div class="big">Team ${r.winner} wins by ${r.margin.toFixed(2)}s</div>
    <div>Seed: <b>${esc(race.seed)}</b></div>
    <div>Team A (${esc(brains.A.name)}): ${fmt(r.times.A)} · ${r.stops.A} stop(s)</div>
    <div>Team B (${esc(bot.name)}): ${fmt(r.times.B)} · ${r.stops.B} stop(s)</div>
    <div class="muted">${race.news.length ? race.news.map((n) => esc(n.text)).join(" · ") : "A clean race, no surprises."}</div>`;
  $("aiStats").innerHTML = `🧠 Team A's AI (simulate ${brains.A.name.includes("simulate") ? "ON" : "OFF"}): ` +
    `<b>${s.calls}</b> AI calls · <b>${s.toolCalls}</b> tool calls · <b>${s.fallbacks}</b> fallback(s) · ` +
    `about <b>$${s.cost.toFixed(4)}</b>`;
  $("result").classList.remove("hidden");
  // Replay slider: drag back through the race.
  $("replay").max = replay.lastLap();
  $("replay").value = replay.lastLap();
  $("replayLap").textContent = replay.lastLap();
  $("replayBox").classList.remove("hidden");
}

function showLap(lap) {
  $("replayLap").textContent = lap;
  drawFrame(replay.frame(lap));
  stage.frame(replay.frame(lap), false);
  radio.render(lap);
}

function download() {
  const log = exportLog(race, { A: brains.A.name, B: bot.name }, brains.A.stats);
  const blob = new Blob([JSON.stringify(log, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `boxbox-${race.seed}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function cap(s) { return s[0].toUpperCase() + s.slice(1); }
function fmt(t) { const m = Math.floor(t / 60); return `${m}:${(t - m * 60).toFixed(2).padStart(5, "0")}`; }
