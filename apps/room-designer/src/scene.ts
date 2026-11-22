import { NAMED_COLORS, PALETTE, THREE, burst, createMotes, damp, type Stage } from '@hocus/three';
import type { HocusRuntime, SceneController } from '@hocus/ui';
import { CATALOG, type Item, type Room } from './app.ts';
import { buildProp, type Prop } from './models.ts';

interface Live {
  holder: THREE.Group;
  prop: Prop;
  item: Item;
  baseColors: number[];
}

/** The 3D haunted room. Reads app state, never writes it. */
export function createRoomScene(stage: Stage, rt: HocusRuntime<Room>): SceneController<Room> {
  const { scene } = stage;
  scene.fog = new THREE.FogExp2(PALETTE.bg, 0.03);

  // Room shell: floor, back wall and side walls are pickable surfaces for "here" / "there".
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x3a2d44, roughness: 0.92 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 14, 1, 1), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 3;
  floor.receiveShadow = true;
  scene.add(floor);
  const boards = new THREE.Group();
  for (let i = -6; i <= 6; i += 0.8) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.005, 8), new THREE.MeshBasicMaterial({ color: 0x1a1220 }));
    l.position.set(i, 0.003, 0);
    boards.add(l);
  }
  scene.add(boards);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x30243f, roughness: 1 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(12, 5), wallMat);
  back.position.set(0, 2.5, -4);
  back.receiveShadow = true;
  scene.add(back);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), wallMat);
  left.position.set(-6, 2.5, 0);
  left.rotation.y = Math.PI / 2;
  scene.add(left);
  const right = left.clone();
  right.position.x = 6;
  right.rotation.y = -Math.PI / 2;
  scene.add(right);
  const skirting = new THREE.Mesh(new THREE.BoxGeometry(12, 0.25, 0.08), new THREE.MeshStandardMaterial({ color: 0x3a2c26 }));
  skirting.position.set(0, 0.12, -3.96);
  scene.add(skirting);
  stage.addSurface('floor', floor);
  stage.addSurface('wall', back);

  // Lights: cold moonlight + warm ambient. "Lights off" dims everything but the candles.
  const ambient = new THREE.HemisphereLight(0xb7a8ff, 0x2a1830, 1.4);
  scene.add(ambient);
  const moon = new THREE.DirectionalLight(0xbcc8ff, 1.8);
  moon.position.set(3, 8, 6);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.left = -7;
  moon.shadow.camera.right = 7;
  moon.shadow.camera.top = 6;
  moon.shadow.camera.bottom = -6;
  scene.add(moon);
  const motes = createMotes(220, new THREE.Vector3(12, 4.5, 8));
  scene.add(motes.points);

  const live = new Map<string, Live>();
  const bursts: Array<(dt: number) => boolean> = [];
  let lightsOn = true;

  const applyTint = (l: Live) => {
    l.prop.tintable.forEach((m, i) => m.color.setHex(l.item.tint ? (NAMED_COLORS[l.item.tint] ?? l.baseColors[i]!) : l.baseColors[i]!));
  };

  stage.onFrame((dt, t) => {
    const rm = stage.reducedMotion;
    if (!rm) motes.update(t);
    const k = rm ? 1000 : 9;
    for (const l of live.values()) {
      const h = l.holder;
      h.position.x = damp(h.position.x, l.item.x, k, dt);
      h.position.y = damp(h.position.y, l.item.y, k, dt);
      h.position.z = damp(h.position.z, l.item.z, k, dt);
      const s = l.item.scale * CATALOG[l.item.type].size;
      h.scale.setScalar(damp(h.scale.x, s, k, dt));
      h.rotation.y = damp(h.rotation.y, l.item.rotation, k, dt);
      if (!rm) l.prop.animate?.(t, dt);
      for (const gl of l.prop.glow) {
        const flick = (gl.light?.userData.flicker as number | undefined) ?? 1;
        gl.mat.emissiveIntensity = (lightsOn ? 1.2 : 2.6) * flick;
        if (gl.light) gl.light.intensity = (lightsOn ? 0.7 : 2.2) * flick;
      }
    }
    ambient.intensity = damp(ambient.intensity, lightsOn ? 1.4 : 0.15, 4, dt);
    moon.intensity = damp(moon.intensity, lightsOn ? 1.8 : 0.25, 4, dt);
    for (let i = bursts.length - 1; i >= 0; i--) if (!bursts[i]!(dt)) bursts.splice(i, 1);
    stage.updateChips();
  });

  return {
    sync(room: Room) {
      lightsOn = room.lightsOn;
      const seen = new Set<string>();
      for (const item of room.items) {
        seen.add(item.id);
        let l = live.get(item.id);
        if (!l) {
          const prop = buildProp(item.type);
          const holder = new THREE.Group();
          holder.add(prop.group);
          holder.position.set(item.x, item.y + (CATALOG[item.type].mount === 'floor' ? 0.6 : 0), item.z);
          holder.scale.setScalar(0.01);
          scene.add(holder);
          l = { holder, prop, item, baseColors: prop.tintable.map((m) => m.color.getHex()) };
          live.set(item.id, l);
          stage.register(item.id, holder);
        }
        l.item = item;
        applyTint(l);
      }
      for (const [id, l] of live)
        if (!seen.has(id)) {
          scene.remove(l.holder);
          stage.unregister(id);
          live.delete(id);
        }
      void rt;
    },
    onExecuted(_action, _args, ids) {
      if (stage.reducedMotion) return;
      for (const id of ids) {
        const l = live.get(id);
        if (l) bursts.push(burst(scene, l.holder.position.clone().add(new THREE.Vector3(0, 0.6, 0))));
      }
    },
    dispose() {
      live.clear();
    },
  };
}
