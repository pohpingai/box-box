// three/drone.js — the camera, flown like a slow drone: it circles the city.
// For a big moment it swoops in close to a car for 2 seconds, then flies back.
// With "reduce motion" switched on in the phone/computer settings it holds still
// and never swoops.
import * as THREE from "../vendor/three/three.module.min.js";

const ORBIT_SECONDS = 150; // one full circle
const IN = 0.7, HOLD = 2, OUT = 1.2; // swoop timing (seconds)

export function makeDrone(camera, track, reduceMotion) {
  let angle = 0.6, focus = null; // focus = { follow(), age }
  const centre = new THREE.Vector3(0, 0, 0);
  const orbitPos = new THREE.Vector3(), closePos = new THREE.Vector3();
  const look = new THREE.Vector3(), target = new THREE.Vector3();

  return {
    // follow() = where the car is right now.
    closeUp(follow) {
      if (reduceMotion) return;
      // Already close? Just switch car and restart the 2 seconds, no jump back out.
      focus = { follow, age: focus && focus.age > IN && focus.age < IN + HOLD ? IN : 0 };
    },
    update(dt, aspect) {
      if (!reduceMotion) angle += (dt / ORBIT_SECONDS) * Math.PI * 2;
      // Phones (tall screens) need the drone further back to fit the track in.
      const dist = track.radius * (aspect < 1 ? 2.2 : 1.75);
      orbitPos.set(Math.cos(angle) * dist, dist * 0.62, Math.sin(angle) * dist);

      let w = 0;
      if (focus) {
        focus.age += dt;
        const a = focus.age;
        w = a < IN ? a / IN : a < IN + HOLD ? 1 : 1 - (a - IN - HOLD) / OUT;
        w = smooth(Math.max(0, Math.min(1, w)));
        const car = focus.follow();
        target.set(car.x, 0, car.z);
        // Close spot: on the drone's side of the car, high enough to clear the towers.
        const back = new THREE.Vector3(orbitPos.x - car.x, 0, orbitPos.z - car.z).normalize();
        const d = aspect < 1 ? 55 : 42; // phones: a bit further back
        closePos.set(car.x + back.x * d, d * 0.75, car.z + back.z * d);
        if (focus.age > IN + HOLD + OUT) focus = null;
      }
      camera.position.lerpVectors(orbitPos, closePos, w);
      look.lerpVectors(centre, target, w);
      camera.lookAt(look);
    },
  };
}

function smooth(t) { return t * t * (3 - 2 * t); }
