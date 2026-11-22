// three/view.js — the 3D Las Vegas night view. Puts the pieces together:
// city + landmarks + glowing track + cars + pop-up words + drone camera,
// and the "bloom" effect that makes bright things glow.
//
// The page talks to it with three calls:
//   setFrame(frame, animate) — a lap has finished: move the cars to the new gaps
//   moment(kind, team)       — "sc" / "box" / "overtake": pop-up word + close-up
//   (it asks the page for the lap speed and pause state itself, every frame)
import * as THREE from "../vendor/three/three.module.min.js";
import { EffectComposer } from "../vendor/three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "../vendor/three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "../vendor/three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "../vendor/three/addons/postprocessing/OutputPass.js";
import { VEGAS } from "../track/vegas.js";
import { buildTrack } from "./track3d.js";
import { makeRibbon } from "./ribbon.js";
import { makeCity } from "./city.js";
import { makeLandmarks } from "./landmarks.js";
import { makeCars, TEAM_COLOURS } from "./cars.js";
import { makeLabels } from "./labels.js";
import { makeDrone } from "./drone.js";

const WORDS = {
  sc: { text: "SAFETY CAR", colour: "#ffd400" },
  box: { text: "BOX BOX", colour: null },     // in the team's colour
  overtake: { text: "OVERTAKE", colour: "#ff3df0" },
};

export function makeView(host, { getMsPerLap, isPaused }) {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); // sharper costs battery; 1.5 is plenty with the glow
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020308);
  scene.fog = new THREE.FogExp2(0x020308, 0.0042);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 2000);

  const track = buildTrack(VEGAS.coords);
  const ribbon = makeRibbon(track);
  const landmarks = makeLandmarks(track);
  const cars = makeCars(track);
  const labels = makeLabels();
  scene.add(makeCity(track), ribbon, landmarks, cars.group, labels.group);
  const drone = makeDrone(camera, track, reduceMotion);

  // Bloom: anything bright gets a soft glow round it.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.8, 0.45, 0.25);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // Keep the picture the size of its box (phone rotation, window resize).
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.strength = w < 600 ? 0.55 : 0.8; // small screens: gentler glow, or close-ups wash out
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);
  resize();

  // Only draw while the view is on screen (saves the phone's battery).
  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(host);

  // Lap playback clock: 0 → 1 over one lap's time, frozen while paused.
  let lapClock = 0, playing = false;
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!visible) return;
    const t = clock.elapsedTime;
    if (playing && !isPaused()) lapClock = Math.min(1, lapClock + (dt * 1000) / getMsPerLap());
    cars.update(lapClock);
    landmarks.userData.update(t);
    labels.update(dt);
    drone.update(dt, camera.aspect);
    composer.render();
  });

  return {
    setFrame(frame, animate = true) {
      cars.setFrame(frame, animate);
      lapClock = animate ? 0 : 1;
      playing = animate;
      cars.update(lapClock);
      ribbon.userData.setSafetyCar(frame.safetyCar);
    },
    moment(kind, team) {
      const w = WORDS[kind];
      if (!w) return;
      // Safety car: follow the leader (the car right behind the safety car).
      const follow = () => cars.position(team);
      labels.show(w.text, w.colour || TEAM_COLOURS[team], follow);
      drone.closeUp(follow);
    },
  };
}
