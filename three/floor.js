// three/floor.js — the ground: a dark, glossy floor that faintly mirrors the
// neon above it (like wet tarmac at night), with a faint purple grid on top
// and small glowing dots where the grid lines cross.
//
// How the mirror works: a second, hidden camera looks UP from under the floor
// and draws the scene into a small picture, which is laid on the floor. That
// picture is half the screen's size (or a quarter on phones), so it costs
// little and comes out slightly soft, which suits a glossy floor anyway.
// The mirror image is dimmed (REFLECT) and fades into the fog in the distance.
import * as THREE from "../vendor/three/three.module.min.js";
import { Reflector } from "../vendor/three/addons/objects/Reflector.js";

const REFLECT = new THREE.Color().setRGB(0.3, 0.24, 0.4); // how much light the floor gives back (purple-tinted)

export function makeFloor(track, { small }) {
  const g = new THREE.Group();
  const size = track.radius * 16;
  const mirror = new Reflector(new THREE.PlaneGeometry(size, size), {
    textureWidth: 512, textureHeight: 512, multisample: 0, shader: GLOSSY,
  });
  mirror.material.uniforms.color.value = REFLECT;
  mirror.material.fog = true; // fade into the fog like everything else
  mirror.rotation.x = -Math.PI / 2;
  g.add(mirror);

  const grid = new THREE.GridHelper(size, Math.round(size / 12), 0x8040e0, 0x6030b0);
  grid.position.y = 0.01;
  grid.material.transparent = true;
  grid.material.opacity = 0.35;
  g.add(grid);

  // Small purple dots where the grid lines cross (evenly spaced, like a hologram table).
  const pos = [], step = size / Math.round(size / 12), half = track.radius * 5;
  for (let x = -half; x <= half; x += step) for (let z = -half; z <= half; z += step) pos.push(x, 0.05, z);
  const dots = new THREE.BufferGeometry();
  dots.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.add(new THREE.Points(dots, new THREE.PointsMaterial({ color: new THREE.Color(0.8, 0.35, 1.4), size: 0.6, toneMapped: false })));

  // Things that shouldn't show in the mirror (the floating call tags and pop-up
  // words: mirrored text just looks like a glitch). Hidden only while the
  // mirror picture is drawn.
  const skip = [];
  const drawMirror = mirror.onBeforeRender;
  mirror.onBeforeRender = function (...args) {
    const was = skip.map((o) => o.visible);
    skip.forEach((o) => (o.visible = false));
    drawMirror.apply(this, args);
    skip.forEach((o, i) => (o.visible = was[i]));
  };
  g.userData.skipInMirror = (...objs) => skip.push(...objs);

  // Keep the mirror picture in step with the screen size.
  g.userData.setSize = (w, h) => {
    const k = small ? 0.25 : 0.5;
    mirror.getRenderTarget().setSize(Math.max(64, Math.round(w * k)), Math.max(64, Math.round(h * k)));
  };
  return g;
}

// The floor's look: the mirror picture × REFLECT (a dim, purple-tinted mirror),
// then fog. (Based on three's own Reflector shader, with fog added.)
const GLOSSY = {
  name: "GlossyFloor",
  uniforms: {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
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
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    varying vec4 vUv;
    #include <common>
    #include <fog_pars_fragment>
    void main() {
      vec3 base = texture2DProj(tDiffuse, vUv).rgb;
      gl_FragColor = vec4(base * color, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
};
