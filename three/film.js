// three/film.js — the last touch on every picture, like a TV camera lens:
//   - vignette: the corners a little darker,
//   - film grain: a very light shimmer of noise,
//   - fade: dips to black for a camera cut (0 = clear, 1 = black).
export const FilmShader = {
  name: "FilmLook",
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    grain: { value: 0.035 },
    vignette: { value: 0.45 },
    fade: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time, grain, vignette, fade;
    varying vec2 vUv;
    float rand(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float d = distance(vUv, vec2(0.5));
      c.rgb *= 1.0 - vignette * smoothstep(0.35, 0.85, d);
      c.rgb += (rand(vUv * 1000.0 + fract(time) * 100.0) - 0.5) * grain;
      c.rgb *= 1.0 - fade;
      gl_FragColor = c;
    }`,
};
