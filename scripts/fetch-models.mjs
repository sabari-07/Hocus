// Self-host MediaPipe WASM + model files so judging day never depends on a third-party CDN.
// Downloads each model once into .cache/models, then copies models and WASM into every app's public/.
// Model licence: Apache-2.0 (MediaPipe). Usage: npm run models
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MODELS = {
  'gesture_recognizer.task':
    'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
  'face_landmarker.task':
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
};
const APPS = ['apps/room-designer', 'apps/planet-explorer', 'examples/kitchen-board'];
const CACHE = '.cache/models';
const WASM = 'node_modules/@mediapipe/tasks-vision/wasm';

mkdirSync(CACHE, { recursive: true });
for (const [name, url] of Object.entries(MODELS)) {
  const dest = join(CACHE, name);
  if (existsSync(dest) && statSync(dest).size > 100_000) continue;
  process.stdout.write(`downloading ${name} ... `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log(`${(statSync(dest).size / 1e6).toFixed(1)} MB`);
}
for (const app of APPS) {
  if (!existsSync(app)) continue;
  const m = join(app, 'public/models');
  const w = join(app, 'public/wasm');
  mkdirSync(m, { recursive: true });
  mkdirSync(w, { recursive: true });
  for (const name of Object.keys(MODELS)) copyFileSync(join(CACHE, name), join(m, name));
  for (const f of readdirSync(WASM)) copyFileSync(join(WASM, f), join(w, f));
  console.log(`copied models + wasm -> ${app}/public`);
}
