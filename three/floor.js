// three/floor.js — the ground: a dark, glossy floor that faintly mirrors the
// neon above it (like wet tarmac at night), with a faint purple grid on top
// and small dots where the grid lines cross, both fading out with distance.
//
// How the mirror works: a second, hidden camera looks UP from under the floor
// and draws the scene into a small picture, which is laid on the floor. That
// picture is half the screen's size (or a quarter on phones), so it costs
// little and comes out slightly soft, which suits a glossy floor anyway.
// The mirror image is blurred into soft wet-road streaks, dimmed (REFLECT) and
// fades into the fog in the distance.
import * as THREE from "../vendor/three/three.module.min.js";
import { Reflector } from "../vendor/three/addons/objects/Reflector.js";

const REFLECT = new THREE.Color().setRGB(0.3, 0.22, 0.4); // how much light the floor gives back (purple-tinted)

export function makeFloor(track, { small }) {
  const g = new THREE.Group();
  const size = track.radius * 16;
  const mirror = new Reflector(new THREE.PlaneGeometry(size, size), {
    textureWidth: 512, textureHeight: 512, multisample: 0, shader: glossy(small ? 6 : 14),
  });
  mirror.material.uniforms.color.value = REFLECT;
  mirror.material.fog = true; // fade into the fog like everything else
  mirror.rotation.x = -Math.PI / 2;
  g.add(mirror);

  g.add(gridAndDots(track));

  // Things that shouldn't show in the mirror (the floating call tags and pop-up
  // words: mirrored text just looks like a glitch). Hidden only while the
  // mirror picture is drawn.
  const skip = [];
  const drawMirror = mirror.onBeforeRender;
  mirror.onBeforeRender = function (...args) {
    // No mirror picture needed while the depth-of-field step measures distances.
    if (args[1]?.overrideMaterial) return;
    const was = skip.map((o) => o.visible);
    skip.forEach((o) => (o.visible = false));
    drawMirror.apply(this, args);
    skip.forEach((o, i) => (o.visible = was[i]));
  };
  g.userData.skipInMirror = (...objs) => skip.push(...objs);

  // Keep the mirror picture in step with the screen size.
  g.userData.setSize = (w, h) => {
    const k = small ? 0.2 : 0.35; // small is fine: the picture gets blurred anyway
    mirror.getRenderTarget().setSize(Math.max(64, Math.round(w * k)), Math.max(64, Math.round(h * k)));
  };
  return g;
}

// The floor's look: the mirror picture × REFLECT (a dim, purple-tinted mirror),
// then fog. (Based on three's own Reflector shader, with fog added.)
// Wet road: the mirror picture is blurred (`taps` samples in a small spiral),
// stretched up-and-down like reflections on a wet street, so lights become soft
// streaks instead of a sharp mirror image.
const glossy = (taps) => ({
  name: "GlossyFloor",
  uniforms: {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, blur: { value: 0.018 },
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    #include <common>
    #include <fog_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: /* glsl */ `
    #define TAPS ${taps}
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float blur;
    varying vec4 vUv;
    #include <common>
    #include <fog_pars_fragment>
    void main() {
      vec2 uv = vUv.xy / vUv.w;
      vec3 base = vec3(0.0);
      float total = 0.0;
      for (int i = 0; i < TAPS; i++) {
        float r = sqrt((float(i) + 0.5) / float(TAPS)), a = float(i) * 2.39996;
        vec2 o = vec2(cos(a) * 0.45, sin(a) * 1.6) * r * blur; // taller than wide = wet-road streaks
        float w = 1.0 - 0.6 * r;
        base += texture2D(tDiffuse, uv + o).rgb * w;
        total += w;
      }
      base /= total;
      gl_FragColor = vec4(base * color, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
});

// The purple grid and the small dots where its lines cross. Both fade out with
// distance from the middle of the circuit, so the floor melts into the dark
// instead of ending in a hard edge. (Each line is cut into short pieces so
// every piece can have its own brightness.)
const STEP = 12;
function gridAndDots(track) {
  const half = Math.round((track.radius * 3) / STEP) * STEP;
  const LINE = new THREE.Color(0.2, 0.09, 0.4), DOT = new THREE.Color(0.7, 0.3, 1.2);
  const fade = (x, z) => Math.max(0, 1 - Math.hypot(x, z) / half) ** 1.6;
  const lp = [], lc = [], dp = [], dc = [];
  const seg = (x1, z1, x2, z2) => {
    lp.push(x1, 0.01, z1, x2, 0.01, z2);
    for (const [x, z] of [[x1, z1], [x2, z2]]) { const k = fade(x, z); lc.push(LINE.r * k, LINE.g * k, LINE.b * k); }
  };
  for (let a = -half; a <= half; a += STEP) {
    for (let b = -half; b < half; b += STEP) { seg(a, b, a, b + STEP); seg(b, a, b + STEP, a); }
  }
  for (let x = -half; x <= half; x += STEP) for (let z = -half; z <= half; z += STEP) {
    const k = fade(x, z);
    if (k <= 0) continue;
    dp.push(x, 0.05, z);
    dc.push(DOT.r * k, DOT.g * k, DOT.b * k);
  }
  const group = new THREE.Group();
  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.Float32BufferAttribute(lp, 3));
  lg.setAttribute("color", new THREE.Float32BufferAttribute(lc, 3));
  group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, toneMapped: false })));
  const dg = new THREE.BufferGeometry();
  dg.setAttribute("position", new THREE.Float32BufferAttribute(dp, 3));
  dg.setAttribute("color", new THREE.Float32BufferAttribute(dc, 3));
  group.add(new THREE.Points(dg, new THREE.PointsMaterial({ vertexColors: true, size: 0.35, toneMapped: false })));
  return group;
}
