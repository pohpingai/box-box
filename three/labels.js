// three/labels.js — glowing pop-up words that float in the 3D scene above a car:
// "SAFETY CAR", "BOX BOX", "OVERTAKE". Each one pops in, floats up a little and
// fades out after about 2.5 seconds.
import * as THREE from "../vendor/three/three.module.min.js";

const LIFE = 2.6; // seconds on screen

// Draw the word onto a small canvas, with a soft glow round the letters.
function wordTexture(text, colour) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const g = c.getContext("2d");
  g.font = "900 64px ui-monospace, Menlo, Consolas, monospace";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.shadowColor = colour; g.shadowBlur = 28;
  g.fillStyle = colour;
  g.fillText(text, 256, 66);
  g.fillText(text, 256, 66); // twice: a stronger glow
  g.shadowBlur = 0;
  g.lineWidth = 2;
  g.strokeStyle = "rgba(255, 255, 255, 0.7)"; // thin bright outline, like a neon tube
  g.strokeText(text, 256, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeLabels() {
  const group = new THREE.Group();
  const live = [];
  return {
    group,
    // follow() returns the position to float above (so the word moves with the car).
    show(text, colour, follow) {
      const mat = new THREE.SpriteMaterial({ map: wordTexture(text, colour), transparent: true, depthTest: false, toneMapped: false });
      const sprite = new THREE.Sprite(mat);
      sprite.renderOrder = 10;
      group.add(sprite);
      live.push({ sprite, follow, age: 0 });
    },
    update(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const L = live[i];
        L.age += dt;
        const pop = Math.min(1, L.age / 0.25);                     // quick pop in…
        const fade = Math.min(1, Math.max(0, (LIFE - L.age) / 0.6)); // …slow fade out
        const scale = 6 * (0.6 + 0.4 * backOut(pop));
        L.sprite.scale.set(scale * 4, scale, 1);
        L.sprite.material.opacity = 0.8 * fade;
        const p = L.follow();
        L.sprite.position.set(p.x, p.y + 5 + L.age * 0.8 + i * 7, p.z);
        if (L.age > LIFE) {
          group.remove(L.sprite);
          L.sprite.material.map.dispose();
          L.sprite.material.dispose();
          live.splice(i, 1);
        }
      }
    },
  };
}

// A little overshoot, so the word "pops".
function backOut(t) { const s = 1.7; return 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2; }
