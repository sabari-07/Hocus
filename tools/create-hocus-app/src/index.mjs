#!/usr/bin/env node
// create-hocus-app: scaffold a new Hocus app (defineApp file, a three.js scene with three pointable cubes,
// mount file, html, vite config) plus a passing test. Usage:
//   node tools/create-hocus-app/src/index.mjs my-app "My App" [--port 5290]
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [id, title = 'My Hocus App', ...rest] = process.argv.slice(2);
if (!id || !/^[a-z][a-z0-9-]{1,40}$/.test(id)) {
  console.error('usage: create-hocus-app <kebab-case-id> "<Title>" [--port N]');
  process.exit(1);
}
const portIdx = rest.indexOf('--port');
const port = portIdx >= 0 ? Number(rest[portIdx + 1]) : 5290;
const dir = join('examples', id);
if (existsSync(dir)) {
  console.error(`${dir} already exists`);
  process.exit(1);
}
const camel = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const files = {
  'package.json': JSON.stringify(
    {
      name: `@hocus/${id}`,
      version: '0.1.0',
      private: true,
      license: 'MIT',
      type: 'module',
      scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
      dependencies: { '@hocus/core': '0.1.0', '@hocus/ui': '0.1.0', '@hocus/three': '0.1.0', three: '^0.187.0', react: '^19.3.1', 'react-dom': '^19.3.1' },
      devDependencies: { vite: '^8.3.8', '@vitejs/plugin-react': '^6.3.0', tailwindcss: '^4.3.5', '@tailwindcss/vite': '^4.3.5', 'vite-plugin-pwa': '^2.0.0', '@types/react': '^19.3.0', '@types/three': '^0.187.0' },
    },
    null,
    2,
  ),
  'vite.config.ts': `import { hocusVite } from '../../scripts/vite-shared.ts';\n\nexport default hocusVite({ name: ${JSON.stringify(title)}, short: ${JSON.stringify(title.slice(0, 12))}, port: ${port} });\n`,
  'index.html': `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Hocus · ${title}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n`,
  'src/app.ts': `import { defineApp } from '@hocus/core';

/** ${title}: behaviour only. Keep this file under 150 lines. */
export interface State {
  boxes: Array<{ id: string; label: string; scale: number; color: string }>;
}

export const ${camel}App = defineApp<State>({
  id: '${id}',
  title: ${JSON.stringify(title)},
  initialState: {
    boxes: [
      { id: 'box-1', label: 'Red box', scale: 1, color: 'red' },
      { id: 'box-2', label: 'Green box', scale: 1, color: 'green' },
      { id: 'box-3', label: 'Blue box', scale: 1, color: 'blue' },
    ],
  },
  selectables: (s) => s.boxes.map((b) => ({ id: b.id, label: b.label, kind: 'box', caps: ['scalable', 'colorable'] })),
  actions: {
    scale: {
      slots: { target: 'object', factor: 'factor' },
      defaults: { factor: 1.25 },
      reduce: (s, a) => ({ ...s, boxes: s.boxes.map((b) => (b.id === a.target ? { ...b, scale: b.scale * Number(a.factor) } : b)) }),
      examples: { en: ['make that bigger'], hi: ['इसे बड़ा करो'], ta: ['இதை பெரிதாக்கு'] },
      menuLabel: 'Bigger',
    },
    recolor: {
      slots: { target: 'object', color: 'color' },
      reduce: (s, a) => ({ ...s, boxes: s.boxes.map((b) => (b.id === a.target ? { ...b, color: String(a.color) } : b)) }),
      examples: { en: ['turn this purple'], hi: ['इसे लाल करो'], ta: ['இதை பச்சையாக்கு'] },
      menuLabel: 'Turn green',
    },
  },
});

export default ${camel}App;
`,
  'src/scene.ts': `import { NAMED_COLORS, THREE, damp, type Stage } from '@hocus/three';
import type { HocusRuntime, SceneController } from '@hocus/ui';
import type { State } from './app.ts';

export function createScene(stage: Stage, _rt: HocusRuntime<State>): SceneController<State> {
  stage.scene.add(new THREE.HemisphereLight(0xb7a8ff, 0x1a1020, 1.6));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x2a2040 }));
  floor.rotation.x = -Math.PI / 2;
  stage.scene.add(floor);
  stage.addSurface('floor', floor);
  const meshes = new Map<string, THREE.Mesh>();
  let target = new Map<string, number>();
  stage.onFrame((dt) => meshes.forEach((m, id) => m.scale.setScalar(damp(m.scale.x, target.get(id) ?? 1, 8, dt))));
  return {
    sync(s) {
      target = new Map(s.boxes.map((b) => [b.id, b.scale]));
      s.boxes.forEach((b, i) => {
        let m = meshes.get(b.id);
        if (!m) {
          m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
          m.position.set((i - 1) * 2.4, 0.6, 0);
          stage.scene.add(m);
          meshes.set(b.id, m);
          stage.register(b.id, m);
        }
        (m.material as THREE.MeshStandardMaterial).color.setHex(NAMED_COLORS[b.color] ?? 0xffffff);
      });
    },
    dispose() {
      meshes.clear();
    },
  };
}
`,
  'src/main.tsx': `import { createRoot } from 'react-dom/client';
import { HocusApp, appLinks } from '@hocus/ui';
import { ${camel}App } from './app.ts';
import { createScene } from './scene.ts';

createRoot(document.getElementById('root')!).render(
  <HocusApp
    app={${camel}App}
    stage={{ label: ${JSON.stringify(`${title}: three boxes you can point at`)}, cameraPosition: [0, 3, 7], lookAt: [0, 0.6, 0] }}
    createScene={createScene}
    judge={[{ point: 'box-1', say: 'make that bigger', caption: 'Point and speak.' }]}
    links={appLinks()}
  />,
);
`,
};
for (const [rel, text] of Object.entries(files)) {
  const p = join(dir, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, text);
}
mkdirSync('tests/unit', { recursive: true });
writeFileSync(
  join('tests/unit', `${id}.test.ts`),
  `import { expect, it } from 'vitest';
import { createEngine, lintLexicon } from '@hocus/core';
import { ${camel}App } from '../../examples/${id}/src/app.ts';

it('${id}: selecting a box and typing "make that bigger" scales it', () => {
  const e = createEngine(${camel}App);
  let s = e.initial();
  s = e.step(s, { type: 'select', t: 1, ids: ['box-2'], mode: 'replace' }).state;
  s = e.step(s, { type: 'speech', speech: { t: 2, kind: 'typed', text: 'make that bigger', lang: 'en' } }).state;
  s = e.step(s, { type: 'tick', t: 1000 }).state;
  expect(s.doc.app.boxes[1]!.scale).toBeCloseTo(1.25);
  expect(lintLexicon(${camel}App).filter((i) => i.severity === 'error')).toEqual([]);
});
`,
);
console.log(`Created ${dir} and tests/unit/${id}.test.ts. Next: npm install && npm run models && npm run dev -w @hocus/${id}`);
