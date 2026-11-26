// three/view.js — the 3D Las Vegas night race, shown like an F1 TV broadcast.
// Puts the pieces together: a wet-look floor (floor.js) + black night + the city
// from the Blender kit (city.js) + the Blender landmarks (heroes.js) + the purple
// neon road + cars with light trails, filmed by a TV "director" (director.js) that
// cuts between chase, trackside, helicopter and overview cameras, through a
// film-look chain (post.js: depth of field, bloom, anti-aliasing, vignette, grain).
//
// The page talks to it with three calls:
//   setFrame(frame, animate) — a lap has finished: move the cars to the new gaps
//                              and show each team's latest call on its tag
//   moment(kind, team)       — "sc" / "box" / "overtake": pop-up word + a camera cut to it
//   (it asks the page for the lap speed and pause state itself, every frame)
import * as THREE from "../vendor/three/three.module.min.js";
import { VEGAS } from "../track/vegas.js";
import { buildTrack } from "./track3d.js";
import { makeRibbon } from "./ribbon.js";
import { makeCity } from "./city.js";
import { addHeroes, heroSpots } from "./heroes.js";
import { makeFloor } from "./floor.js";
import { makeCars, TEAM_COLOURS } from "./cars.js";
import { makeLabels } from "./labels.js";
import { makeTags } from "./tags.js";
import { makeDirector } from "./director.js";
import { camSpots } from "./camspots.js";
import { makePost } from "./post.js";
import { RULES } from "../race.js";

const WORDS = {
  sc: { text: "SAFETY CAR", colour: "#ffd400" },
  box: { text: "BOX BOX", colour: null },     // in the team's colour
  overtake: { text: "OVERTAKE", colour: "#ff3df0" },
};

export function makeView(host, { getMsPerLap, isPaused }) {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Phones / small screens get a lighter film look (no depth of field, no SMAA).
  const small = Math.min(innerWidth, innerHeight) < 600;
  const lock = new URLSearchParams(location.search).get("cam"); // ?cam=chase|turn|heli|overview holds one camera
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
  const camera = new THREE.PerspectiveCamera(45, 1, 0.3, 2000);
  // Tags and pop-up words live in their own little scene, drawn on top after
  // the depth of field, so they always stay sharp.
  const overlay = new THREE.Scene();

  const track = buildTrack(VEGAS.coords);
  track.landmarkSpots = heroSpots(); // the city keeps clear of the landmarks
  const ribbon = makeRibbon(track);
  const cars = makeCars(track);
  const labels = makeLabels();
  const tags = makeTags(["A", "B"], TEAM_COLOURS);
  tags.setCalls({});
  const floor = makeFloor(track, { small });
  scene.add(floor, makeCity(track), ribbon, cars.group);
  overlay.add(tags.group, labels.group);
  // Keep the dome out of the mirror: its gold rings made an orange blob on the floor under it.
  addHeroes(scene).userData.ready.then((h) => h && floor.userData.skipInMirror(...h.userData.dome)); // loads in the background; appears when ready
  const [dome] = heroSpots();
  const director = makeDirector(camera, track, cars, camSpots(track), dome, { reduceMotion, lock });
  const post = makePost(renderer, scene, overlay, camera, { small });

  // A small "CAM · CHASE" label at the top, like on TV.
  const camLabel = document.createElement("div");
  camLabel.className = "stage-cam";
  host.append(camLabel);

  // Keep the picture the size of its box (phone rotation, window resize).
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    post.setSize(w, h);
    floor.userData.setSize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);
  resize();

  // Only draw while the view is on screen (saves the phone's battery).
  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(host);

  // Lap playback clock: 0 → 1 over one lap's time, frozen while paused.
  let lapClock = 0, playing = false, lap = 0;
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!visible) return;
    if (playing && !isPaused()) lapClock = Math.min(1, lapClock + (dt * 1000) / getMsPerLap());
    cars.update(lapClock);
    labels.update(dt);
    tags.update(cars.position, camera.aspect);
    // Overview before the start, at the finish and while paused; TV cameras the rest of the time.
    const overview = (lap === 0 && !playing) || lap >= RULES.laps || isPaused();
    director.update(dt, camera.aspect, { overview, leader: cars.leader() });
    const label = `CAM · ${director.label()}`;
    if (camLabel.textContent !== label) camLabel.textContent = label;
    // Close to the neon (chase cam) the glow is turned down so it doesn't wash out.
    const glow = { chase: 0.6, turn: 0.7, heli: 0.9 }[director.kind] ?? 1;
    ribbon.userData.setBrightness({ chase: 0.5, turn: 0.6, heli: 0.85 }[director.kind] ?? 1);
    post.render({ time: clock.elapsedTime, fade: director.fade, focus: director.focus, aperture: director.aperture, glow });
  });

  return {
    setFrame(frame, animate = true) {
      cars.setFrame(frame, animate);
      lap = frame.lap;
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
      director.moment(kind, team);
    },
  };
}
