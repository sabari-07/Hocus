import { PALETTE, THREE, burst, createMotes, damp, type Stage } from '@hocus/three';
import type { HocusRuntime, SceneController } from '@hocus/ui';
import { BODIES, body, type Sky } from './app.ts';

/** Procedural banded texture (no photo textures, no licences). */
function bandTexture(hex: string, bands: number, contrast: number) {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 128;
  const g = c.getContext('2d')!;
  const base = new THREE.Color(hex);
  for (let y = 0; y < 128; y++) {
    const v = Math.sin((y / 128) * Math.PI * bands) * 0.5 + Math.sin((y / 128) * Math.PI * bands * 2.7) * 0.2;
    const col = base.clone().offsetHSL(0, 0, v * contrast);
    g.fillStyle = `#${col.getHexString()}`;
    g.fillRect(0, y, 8, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const BANDS: Record<string, [number, number]> = { jupiter: [9, 0.12], saturn: [7, 0.07], uranus: [3, 0.03], neptune: [4, 0.06], venus: [3, 0.05], mars: [2, 0.06], mercury: [2, 0.05], earth: [3, 0.08] };

/** Readable layout: even spacing and sizes that stay pointable (>= ~56 px). */
const READABLE = { gap: 2.15, start: 3.2, size: (km: number) => 0.32 + Math.log10(km / 3000) * 0.42 };
const TRUE = { dist: (mkm: number) => 2.6 + Math.sqrt(mkm) * 0.5, size: (km: number) => Math.max(0.06, (km / 142984) * 1.6) };

interface LiveBody {
  id: string;
  holder: THREE.Group;
  mesh: THREE.Mesh;
  orbit?: THREE.Line;
  angle: number;
  radius: number;
  size: number;
}

export function createPlanetScene(stage: Stage, rt: HocusRuntime<Sky>): SceneController<Sky> {
  const { scene, camera } = stage;
  scene.add(new THREE.AmbientLight(0xb7a8ff, 1.1));
  const sunLight = new THREE.PointLight(0xfff1d6, 60, 0, 1.4);
  scene.add(sunLight);
  const stars = createMotes(900, new THREE.Vector3(120, 60, 120), 0xffffff);
  stars.points.position.y = -20;
  (stars.points.material as THREE.PointsMaterial).size = 0.12;
  scene.add(stars.points);

  let sky: Sky = rt.state.doc.app;
  const live = new Map<string, LiveBody>();
  const moonGroup = new THREE.Group();
  scene.add(moonGroup);
  const bursts: Array<(dt: number) => boolean> = [];
  let timeScale = 1;
  const planets = BODIES.filter((b) => b.kind === 'planet');

  for (const b of BODIES) {
    const holder = new THREE.Group();
    const isSun = b.kind === 'star';
    const mat = isSun
      ? new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff8a1a, emissiveIntensity: 1.05 })
      : new THREE.MeshStandardMaterial({ color: 0xffffff, map: bandTexture(b.color, BANDS[b.id]?.[0] ?? 2, BANDS[b.id]?.[1] ?? 0.04), roughness: 0.85 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), mat);
    holder.add(mesh);
    if (b.id === 'saturn') {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.35, 2.25, 64),
        new THREE.MeshStandardMaterial({ color: 0xead49b, side: THREE.DoubleSide, transparent: true, opacity: 0.75, roughness: 0.9 }),
      );
      ring.rotation.x = -Math.PI / 2.4;
      mesh.add(ring);
    }
    if (b.id === 'uranus') mesh.rotation.z = (97.8 * Math.PI) / 180;
    scene.add(holder);
    const idx = planets.findIndex((p) => p.id === b.id);
    const lb: LiveBody = { id: b.id, holder, mesh, angle: idx * 1.37 + 0.4, radius: 0, size: 1 };
    if (b.kind === 'planet') {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 128; i++) pts.push(new THREE.Vector3(Math.cos((i / 128) * Math.PI * 2), 0, Math.sin((i / 128) * Math.PI * 2)));
      lb.orbit = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: PALETTE.violet, transparent: true, opacity: 0.28 }));
      scene.add(lb.orbit);
    }
    live.set(b.id, lb);
    stage.register(b.id, holder, { radius: 1.15 });
  }

  const layout = () => {
    planets.forEach((p, i) => {
      const lb = live.get(p.id)!;
      lb.radius = sky.trueScale ? TRUE.dist(p.distanceMkm) : READABLE.start + i * READABLE.gap;
      lb.size = sky.trueScale ? TRUE.size(p.diameterKm) : READABLE.size(p.diameterKm);
    });
    const sun = live.get('sun')!;
    sun.size = sky.trueScale ? 2.2 : 1.6;
    const moon = live.get('moon')!;
    moon.size = sky.trueScale ? TRUE.size(body('moon').diameterKm) : 0.24;
    moon.radius = sky.trueScale ? 0.5 : 0.95;
  };
  layout();

  const camTarget = new THREE.Vector3(9, 0, 0);
  const camPos = new THREE.Vector3(9, 13, 17);
  const lookAt = new THREE.Vector3(9, 0, 0);
  camera.position.copy(camPos);
  camera.lookAt(lookAt);

  const showMoons = (id: string | null) => {
    moonGroup.clear();
    if (!id) return;
    const n = Math.min(body(id).moons ?? 0, 14);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.06 + (i % 3) * 0.02, 10, 8), new THREE.MeshStandardMaterial({ color: 0xcfcad6 }));
      m.userData = { a: (i / n) * Math.PI * 2, r: 1.25 + (i % 4) * 0.22, tilt: (i % 5) * 0.3 };
      moonGroup.add(m);
    }
    moonGroup.userData.of = id;
  };

  stage.onFrame((dt, t) => {
    const rm = stage.reducedMotion;
    const k = rm ? 1000 : 4;
    // Time slows to 15% while the pointer rests on any body, so moving targets stay easy to point at.
    const hovering = !!rt.ui.getState().pointer?.topHit;
    timeScale = damp(timeScale, hovering ? 0.15 : 1, 6, dt);
    const sp = sky.speed * timeScale;
    for (const p of planets) {
      const lb = live.get(p.id)!;
      lb.angle += rm ? 0 : dt * sp * (0.16 / Math.sqrt(p.yearDays! / 88));
      lb.holder.position.set(Math.cos(lb.angle) * lb.radius, 0, Math.sin(lb.angle) * lb.radius);
      lb.orbit!.scale.setScalar(damp(lb.orbit!.scale.x || lb.radius, lb.radius, k, dt));
      lb.mesh.rotation.y += rm ? 0 : dt * 0.4;
    }
    const earth = live.get('earth')!;
    const moon = live.get('moon')!;
    moon.angle += rm ? 0 : dt * sp * 0.6;
    moon.holder.position.copy(earth.holder.position).add(new THREE.Vector3(Math.cos(moon.angle) * (earth.size + moon.radius), 0.1, Math.sin(moon.angle) * (earth.size + moon.radius)));
    for (const lb of live.values()) lb.holder.scale.setScalar(damp(lb.holder.scale.x, lb.size, k, dt));
    if (moonGroup.userData.of) {
      const host = live.get(moonGroup.userData.of as string)!;
      moonGroup.position.copy(host.holder.position);
      moonGroup.children.forEach((m) => {
        const u = m.userData as { a: number; r: number; tilt: number };
        if (!rm) u.a += dt * (1.6 / u.r);
        const r = u.r * host.size;
        m.position.set(Math.cos(u.a) * r, Math.sin(u.a) * u.tilt * 0.3, Math.sin(u.a) * r);
      });
    }
    // Camera: fly to the focused body, else an overview.
    const f = sky.focus ? live.get(sky.focus) : null;
    if (f) {
      camTarget.copy(f.holder.position);
      const d = Math.max(3, f.size * 6);
      camPos.set(f.holder.position.x + d * 0.6, d * 0.7, f.holder.position.z + d);
    } else {
      const span = sky.trueScale ? 38 : 21;
      camTarget.set(span * 0.12, 0, span * 0.08);
      camPos.set(span * 0.12, span * 1.05, span * 1.25);
    }
    const kc = rm ? 1000 : 2.5;
    camera.position.set(damp(camera.position.x, camPos.x, kc, dt), damp(camera.position.y, camPos.y, kc, dt), damp(camera.position.z, camPos.z, kc, dt));
    lookAt.set(damp(lookAt.x, camTarget.x, kc, dt), damp(lookAt.y, camTarget.y, kc, dt), damp(lookAt.z, camTarget.z, kc, dt));
    camera.lookAt(lookAt);
    if (!rm) stars.update(t * 0.2);
    for (let i = bursts.length - 1; i >= 0; i--) if (!bursts[i]!(dt)) bursts.splice(i, 1);
    stage.updateChips();
  });

  return {
    sync(next) {
      const relayout = next.trueScale !== sky.trueScale;
      const moonsChanged = next.moonsOf !== sky.moonsOf;
      sky = next;
      if (relayout) layout();
      if (moonsChanged) showMoons(next.moonsOf);
      for (const b of BODIES) stage.setChip(b.id, next.focus === b.id || next.info === b.id || next.compare?.includes(b.id) ? b.name : null);
    },
    onExecuted(_a, _args, ids) {
      if (stage.reducedMotion) return;
      for (const id of ids) {
        const lb = live.get(id);
        if (lb) bursts.push(burst(scene, lb.holder.position.clone(), PALETTE.teal, 30));
      }
    },
    dispose() {
      live.clear();
    },
  };
}
