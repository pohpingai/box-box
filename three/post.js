// three/post.js — the "film look" chain every picture goes through, in order:
//   1. draw the 3D world
//   2. depth of field: things far from the car go soft (big screens only)
//   3. draw the call tags and pop-up words on top (always sharp)
//   4. bloom: only bright things glow (purple stays purple, gold stays gold)
//   5. tone mapping + colours for the screen
//   6. SMAA: smooths jagged edges (big screens only)
//   7. vignette + light film grain + the fade used for camera cuts
// Phones skip steps 2 and 6 to stay smooth.
import * as THREE from "../vendor/three/three.module.min.js";
import { EffectComposer } from "../vendor/three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "../vendor/three/addons/postprocessing/RenderPass.js";
import { BokehPass } from "../vendor/three/addons/postprocessing/BokehPass.js";
import { UnrealBloomPass } from "../vendor/three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "../vendor/three/addons/postprocessing/OutputPass.js";
import { SMAAPass } from "../vendor/three/addons/postprocessing/SMAAPass.js";
import { ShaderPass } from "../vendor/three/addons/postprocessing/ShaderPass.js";
import { FilmShader } from "./film.js";

export const BLOOM = 0.8; // glow strength on a big screen (threshold 0.8: only bright things glow)

export function makePost(renderer, scene, overlay, camera, { small }) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const dof = small ? null : new BokehPass(scene, camera, { focus: 20, aperture: 0.0003, maxblur: 0.006 });
  if (dof) composer.addPass(dof);
  const top = new RenderPass(overlay, camera);
  top.clear = false; // draw on top of the picture so far
  composer.addPass(top);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), BLOOM, 0.6, 0.8);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const smaa = small ? null : new SMAAPass(1, 1);
  if (smaa) composer.addPass(smaa);
  const film = new ShaderPass(FilmShader);
  if (small) film.uniforms.grain.value = 0.025;
  composer.addPass(film);

  return {
    setSize(w, h) { composer.setSize(w, h); },
    // focus = distance to the sharp spot; aperture = how quickly things go soft (0 = all sharp).
    render({ time, fade, focus, aperture, glow }) {
      if (dof) {
        dof.enabled = aperture > 0;
        dof.uniforms.focus.value = focus;
        dof.uniforms.aperture.value = aperture;
      }
      bloom.strength = BLOOM * (small ? 0.8 : 1) * glow;
      film.uniforms.time.value = time;
      film.uniforms.fade.value = fade;
      composer.render();
    },
  };
}
