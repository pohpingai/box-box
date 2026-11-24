// three/view.js — the 3D Las Vegas night view. Puts the pieces together:
// a glossy mirror floor + black night fog + a city built from the Blender kit (city.js) + the Blender-made
// landmarks (dome, twisted tower, Ferris wheel — see heroes.js) + neon
// purple road + cars with light trails + call tags + pop-up words + drone camera,
// and the "bloom" effect that makes bright things glow.
//
// The page talks to it with three calls:
//   setFrame(frame, animate) — a lap has finished: move the cars to the new gaps
//                              and show each team's latest call on its tag
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
import { addHeroes, heroSpots } from "./heroes.js";
import { makeFloor } from "./floor.js";
import { makeCars, TEAM_COLOURS } from "./cars.js";
import { makeLabels } from "./labels.js";
import { makeTags } from "./tags.js";
import { makeDrone } from "./drone.js";

const BLOOM = 0.8; // glow strength on a big screen

const WORDS = {
  sc: { text: "SAFETY CAR", colour: "#ffd400" },
  box: { text: "BOX BOX", colour: null },     // in the team's colour
  overtake: { text: "OVERTAKE", colour: "#ff3df0" },
};

export function makeView(host, { getMsPerLap, isPaused }) {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); // sharper costs battery; 1.5 is plenty with the glow
  // ACES "tone mapping" squeezes very bright light into what a screen can show.
  // (We tried AgX too: it turned far more of the neon white. ACES keeps the colour.)
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  // Black night sky and a faint black fog: far things fade into the dark (depth),
  // and the far floor fades out so it looks endless.
  const FOG = new THREE.Color(0x000000);
  scene.background = FOG;
  scene.fog = new THREE.FogExp2(FOG, 0.0021);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 2000);

  const track = buildTrack(VEGAS.coords);
  track.landmarkSpots = heroSpots(); // the city keeps clear of the landmarks
  const ribbon = makeRibbon(track);
  const cars = makeCars(track);
  const labels = makeLabels();
  const tags = makeTags(["A", "B"], TEAM_COLOURS);
  tags.setCalls({});
  const floor = makeFloor(track, { small: Math.min(innerWidth, innerHeight) < 600 });
  scene.add(floor, makeCity(track), ribbon, cars.group, tags.group, labels.group);
  floor.userData.skipInMirror(tags.group, labels.group);
  addHeroes(scene); // loads in the background; appears when ready
  // The camera circles the whole circuit, aimed a little towards the landmarks.
  const drone = makeDrone(camera, track, reduceMotion, new THREE.Vector3(-6, 8, 8));

  // Bloom: anything bright gets a soft glow round it. Tuned so purple stays
  // purple and gold stays gold: only really bright things glow (threshold 0.8),
  // and gently (0.6) — a stronger, wider glow piles up and turns white.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), BLOOM, 0.6, 0.8);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let baseBloom = BLOOM;
  // Keep the picture the size of its box (phone rotation, window resize).
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    floor.userData.setSize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    baseBloom = w < 600 ? BLOOM * 0.8 : BLOOM; // small screens: gentler glow
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
    if (playing && !isPaused()) lapClock = Math.min(1, lapClock + (dt * 1000) / getMsPerLap());
    cars.update(lapClock);
    labels.update(dt);
    tags.update(cars.position, camera.aspect);
    drone.update(dt, camera.aspect);
    // Close up, the neon fills the screen: turn the glow down so it doesn't wash out.
    bloom.strength = baseBloom * (1 - 0.65 * drone.closeness());
    composer.render();
  });

  return {
    setFrame(frame, animate = true) {
      cars.setFrame(frame, animate);
      lapClock = animate ? 0 : 1;
      playing = animate;
      cars.update(lapClock);
      ribbon.userData.setSafetyCar(frame.safetyCar);
      tags.setCalls(frame.calls);
    },
    speaking(team) { cars.setSpeaking(team); },
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
