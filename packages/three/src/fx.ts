import * as THREE from 'three';
import { PALETTE } from './palette.ts';

/** Drifting fog motes (Points). Cheap ambient motion; frozen when reduced motion is on. */
export function createMotes(count = 260, spread = new THREE.Vector3(14, 5, 10), color: number = PALETTE.violet) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // Deterministic pseudo-random layout (no Math.random needed for visuals either).
    const a = Math.sin(i * 12.9898) * 43758.5453;
    const b = Math.sin(i * 78.233) * 12345.678;
    const c = Math.sin(i * 39.425) * 24634.6345;
    pos[i * 3] = ((a - Math.floor(a)) - 0.5) * spread.x;
    pos[i * 3 + 1] = (b - Math.floor(b)) * spread.y;
    pos[i * 3 + 2] = ((c - Math.floor(c)) - 0.5) * spread.z;
    seed[i] = a - Math.floor(a);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color, size: 0.06, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
  const points = new THREE.Points(geo, mat);
  const base = pos.slice();
  const update = (t: number) => {
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      const s = seed[i]!;
      p.setX(i, base[i * 3]! + Math.sin(t * 0.0002 + s * 20) * 0.4);
      p.setY(i, base[i * 3 + 1]! + Math.sin(t * 0.0003 + s * 10) * 0.15);
    }
    p.needsUpdate = true;
  };
  return { points, update };
}

/** A short particle burst at a point (success feedback). Returns an update fn; done when it returns false. */
export function burst(scene: THREE.Scene, at: THREE.Vector3, color: number = PALETTE.teal, n = 40) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const vel: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    pos.set([at.x, at.y, at.z], i * 3);
    const th = (i / n) * Math.PI * 2;
    const ph = Math.sin(i * 1.7) * 0.9;
    vel.push(new THREE.Vector3(Math.cos(th) * Math.cos(ph), Math.sin(ph) + 0.6, Math.sin(th) * Math.cos(ph)).multiplyScalar(1.6));
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color, size: 0.09, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  let life = 0;
  return (dt: number) => {
    life += dt;
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < n; i++) {
      const v = vel[i]!;
      v.y -= 3 * dt;
      p.setXYZ(i, p.getX(i) + v.x * dt, p.getY(i) + v.y * dt, p.getZ(i) + v.z * dt);
    }
    p.needsUpdate = true;
    mat.opacity = Math.max(0, 1 - life / 0.8);
    if (life > 0.8) {
      scene.remove(pts);
      geo.dispose();
      mat.dispose();
      return false;
    }
    return true;
  };
}

/** Smooth critically-damped approach used for gentle object/camera motion. */
export function damp(current: number, target: number, lambda: number, dt: number) {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}
