import { THREE, damp, type Stage } from '@hocus/three';
import type { HocusRuntime, SceneController } from '@hocus/ui';
import { show, type Kitchen } from './app.ts';

/** Floating 3D recipe cards on a dark board. Text is drawn to canvas textures. */
function cardTexture(text: string, done: boolean, current: boolean, timer: boolean) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 320;
  const g = c.getContext('2d')!;
  g.fillStyle = current ? '#2b2140' : '#1A1426';
  g.fillRect(0, 0, 512, 320);
  g.strokeStyle = done ? '#4FE3C1' : current ? '#FFB347' : '#8E7CFF';
  g.lineWidth = 10;
  g.strokeRect(5, 5, 502, 310);
  g.fillStyle = '#EDEAF7';
  g.font = '600 40px Inter, sans-serif';
  const words = text.split(' ');
  let line = '';
  let y = 90;
  for (const w of words) {
    if (g.measureText(line + w).width > 440) {
      g.fillText(line, 36, y);
      line = '';
      y += 52;
    }
    line += `${w} `;
  }
  g.fillText(line, 36, y);
  g.font = '32px Inter, sans-serif';
  g.fillStyle = done ? '#4FE3C1' : '#FFB347';
  if (done) g.fillText('✓ done', 36, 290);
  else if (timer) g.fillText('⏱ timer running', 36, 290);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createKitchenScene(stage: Stage, _rt: HocusRuntime<Kitchen>): SceneController<Kitchen> {
  const { scene } = stage;
  scene.add(new THREE.HemisphereLight(0xb7a8ff, 0x1a1020, 1.6));
  const board = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshStandardMaterial({ color: 0x2a2040, roughness: 1 }));
  board.position.z = -0.6;
  scene.add(board);
  stage.addSurface('board', board);
  const cards = new Map<string, THREE.Mesh>();
  stage.onFrame((dt, t) => {
    let i = 0;
    for (const m of cards.values()) {
      if (!stage.reducedMotion) m.position.z = damp(m.position.z, (m.userData.current ? 0.5 : 0) + Math.sin(t * 0.001 + i++) * 0.04, 5, dt);
    }
  });
  return {
    sync(s) {
      s.cards.forEach((c, i) => {
        let m = cards.get(c.id);
        if (!m) {
          m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2), new THREE.MeshBasicMaterial({ toneMapped: false }));
          const ing = c.kind === 'ingredient';
          const col = ing ? i : i - 4;
          m.position.set(-5.4 + col * 3.6, ing ? 2.3 : -1.2, 0);
          scene.add(m);
          cards.set(c.id, m);
          stage.register(c.id, m);
        }
        const mat = m.material as THREE.MeshBasicMaterial;
        mat.map?.dispose();
        mat.map = cardTexture(show(c), s.done.includes(c.id), s.current === c.id, s.timers.includes(c.id));
        mat.needsUpdate = true;
        m.userData.current = s.current === c.id;
      });
    },
    dispose() {
      cards.clear();
    },
  };
}
