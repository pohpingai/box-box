// three/tags.js — a floating "hologram" tag above each car showing its
// current call, e.g. "A · BOX MEDIUMS". A thin glowing line connects the tag
// to its car. The tag always stays the same size on screen, so it can be read
// on a phone even when the camera is far away.
import * as THREE from "../vendor/three/three.module.min.js";
import { callToWords } from "../race.js";

const HEIGHT = 9;   // how high above the car the tag floats (3D units)
const SIZE = 0.05;  // tag height as a share of the screen height (roughly)

// "BOX_MEDIUM" → "BOX MEDIUMS", "STAY" → "STAY OUT". No call yet → "ON THE GRID".
export function tagText(team, call) {
  const words = call ? callToWords(call).replace(",", "").toUpperCase() : "ON THE GRID";
  return `${team} · ${words}`;
}

// Draw the tag on a small canvas: dark glass panel, team-colour border and
// glow, the text, and a little signal-bars icon on the right.
function paint(canvas, text, colour) {
  const g = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  g.font = "700 54px ui-monospace, Menlo, Consolas, monospace";
  const textW = g.measureText(text).width;
  const panelW = Math.min(W - 20, textW + 150), x0 = (W - panelW) / 2, y0 = 14, h = H - 28;

  // Panel: dark see-through glass with a glowing border, slanted like the picture.
  g.save();
  g.shadowColor = colour; g.shadowBlur = 18;
  g.beginPath();
  g.moveTo(x0 + 16, y0); g.lineTo(x0 + panelW, y0); g.lineTo(x0 + panelW - 16, y0 + h); g.lineTo(x0, y0 + h); g.closePath();
  g.fillStyle = "rgba(4, 10, 16, 0.72)";
  g.fill();
  g.lineWidth = 4; g.strokeStyle = colour;
  g.stroke();
  g.restore();

  // Text.
  g.textBaseline = "middle";
  g.shadowColor = colour; g.shadowBlur = 10;
  g.fillStyle = "#f4fbff";
  g.fillText(text, x0 + 40, y0 + h / 2 + 2);

  // Signal bars: five little bars getting taller.
  g.shadowBlur = 8; g.fillStyle = colour;
  const bx = x0 + panelW - 92, base = y0 + h - 20;
  for (let i = 0; i < 5; i++) {
    const bh = 10 + i * 9;
    g.fillRect(bx + i * 13, base - bh, 8, bh);
  }
}

export function makeTags(teams, colours) {
  const group = new THREE.Group();
  const tags = {};
  for (const team of teams) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024; canvas.height = 128;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture, transparent: true, depthTest: false, toneMapped: false, sizeAttenuation: false,
    }));
    sprite.center.set(0.5, 0); // the bottom middle of the tag sits on the end of the line
    sprite.renderOrder = 9;
    // The thin line from the car up to the tag (2 points, moved every frame).
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({
      color: new THREE.Color(colours[team]).multiplyScalar(1.6), toneMapped: false, transparent: true, opacity: 0.85,
    }));
    group.add(line, sprite);
    tags[team] = { canvas, texture, sprite, line, text: "" };
  }

  return {
    group,
    // calls = { A: "BOX_MEDIUM", B: "STAY" } (or empty before the start).
    setCalls(calls = {}) {
      for (const team of teams) {
        const t = tags[team], text = tagText(team, calls[team]);
        if (text === t.text) continue;
        t.text = text;
        paint(t.canvas, text, colours[team]);
        t.texture.needsUpdate = true;
      }
    },
    // positionOf(team) = where the car is now; aspect = screen width / height.
    update(positionOf, aspect) {
      for (const team of teams) {
        const t = tags[team], p = positionOf(team);
        // Stagger the two tags so they don't sit on top of each other when the cars are close.
        const lift = HEIGHT + (team === "B" ? 11 : 0);
        t.sprite.position.set(p.x, p.y + lift, p.z);
        t.line.geometry.attributes.position.array.set([p.x, p.y + 1.5, p.z, p.x, p.y + lift, p.z]);
        t.line.geometry.attributes.position.needsUpdate = true;
        t.line.geometry.computeBoundingSphere();
        // Phones (tall screens): a bit bigger so the words stay readable.
        const h = SIZE * (aspect < 1 ? 1.25 : 1) * 0.83; // 0.83 ≈ 2·tan(45°/2), the camera's view height at distance 1
        t.sprite.scale.set(h * 8, h, 1);
      }
    },
  };
}
