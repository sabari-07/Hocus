/**
 * Generates SYNTHETIC replay files for the regression suite (origin: "synthetic").
 * Real sessions exported from the Hocus Lab recorder use origin "recorded" and are never overwritten.
 *   npm run replays:generate
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createEngine, replay, type AppDefinition, type HocusEvent, type PointerSample, type ReplayFile } from '@hocus/core';
import { mergeEvents, utteranceEvents } from '@hocus/testkit';
import { roomApp } from '../apps/room-designer/src/app.ts';
import { planetApp } from '../apps/planet-explorer/src/app.ts';
import { kitchenApp } from '../examples/kitchen-board/src/app.ts';

const DIR = 'tests/replays';
mkdirSync(DIR, { recursive: true });

/** Pointer samples dwelling on `id` (hit quality 1) or on a floor point, at 30 Hz. */
function dwell(t0: number, ms: number, target: string | { x: number; y: number; z: number }, jitter = 1): PointerSample[] {
  const out: PointerSample[] = [];
  for (let t = t0, i = 0; t < t0 + ms; t += 1000 / 30, i++) {
    const j = (i % 2 ? 1 : -1) * jitter;
    out.push(
      typeof target === 'string'
        ? { t, x: 500 + j, y: 400, conf: 0.9, source: 'hand', pose: 'point', hits: [{ id: target, quality: 1 }] }
        : { t, x: 900 + j, y: 600, conf: 0.9, source: 'hand', pose: 'point', hits: [], place: { surface: 'floor', world: target } },
    );
  }
  return out;
}

interface Script {
  name: string;
  app: AppDefinition<unknown>;
  description: string;
  steps: Array<{ point?: string | { x: number; y: number; z: number }; say?: string; typed?: boolean; holdMs?: number; seen?: number[] }>;
}

const SCRIPTS: Script[] = [
  {
    name: 'room-bigger-put-there',
    app: roomApp as AppDefinition<unknown>,
    description: 'Point at Pumpkin 1, "make that bigger"; point at the floor, "put it there".',
    steps: [{ point: 'pumpkin-1', say: 'make that bigger' }, { point: { x: 4, y: 0, z: 2 }, say: 'put it there' }],
  },
  {
    name: 'room-name-and-repair',
    app: roomApp as AppDefinition<unknown>,
    description: 'Name the cat Boris, use the name, then "no, the other one" after pointing between two objects.',
    steps: [{ point: 'cat-1', say: 'call this one Boris' }, { say: 'make Boris bigger', typed: true }, { point: 'ghost-1', say: 'turn this green' }, { say: 'undo', typed: true }],
  },
  {
    name: 'planets-compare',
    app: planetApp as AppDefinition<unknown>,
    description: 'Mars then Earth: "compare this with that" binds in spoken order.',
    // "this" is first heard while still on Mars (offset is relative to the Earth step start).
    steps: [{ point: 'mars', holdMs: 900 }, { point: 'earth', say: 'compare this with that', seen: [-450 + 350 - 500, 900] }],
  },
  {
    name: 'planets-quiz',
    app: planetApp as AppDefinition<unknown>,
    description: 'Start the quiz and answer by pointing at Venus and saying "that one".',
    steps: [{ say: 'start the quiz', typed: true }, { point: 'venus', say: 'that one' }],
  },
  {
    name: 'planets-hindi',
    app: planetApp as AppDefinition<unknown>,
    description: 'Hindi: point at Jupiter, "यह क्या है".',
    steps: [{ point: 'jupiter', say: 'यह क्या है' }],
  },
  {
    name: 'kitchen-double',
    app: kitchenApp as AppDefinition<unknown>,
    description: 'Point at the pumpkin purée, "double this".',
    steps: [{ point: 'pumpkin', say: 'double this' }],
  },
];

for (const sc of SCRIPTS) {
  const lang = /[\u0900-\u097F]/.test(sc.steps.map((s) => s.say ?? '').join('')) ? 'hi' : 'en';
  const events: HocusEvent[] = lang === 'en' ? [] : [{ type: 'lang', t: 0, lang }];
  let t = 1000;
  for (const st of sc.steps) {
    const hold = st.holdMs ?? 1200;
    const samples = st.point ? dwell(t, hold, st.point) : [];
    let speech: HocusEvent[] = [];
    if (st.say && st.typed) speech = [{ type: 'speech', speech: { t: t + hold - 100, kind: 'typed', text: st.say, lang } }];
    else if (st.say) {
      const words = st.say.split(' ').length;
      const timed = Math.max(1, (st.say.match(/\b(this|that|it|there|here|these)\b|यह|वह/g) ?? []).length);
      const seen = st.seen ? st.seen.map((o) => t + o) : Array.from({ length: timed }, (_, k) => t + hold - 350 + k * 250);
      speech = utteranceEvents(st.say, Math.min(t + 200, seen[0]! - 300), seen, t + hold + 150 + words * 20, lang);
    }
    events.push(...mergeEvents(samples.map((sample) => ({ type: 'pointer', sample })), speech));
    // Ticks well after the 600 ms preview so each command executes before the next one.
    t += hold + 900;
    events.push({ type: 'tick', t });
    t += 400;
    events.push({ type: 'tick', t });
  }
  const engine = createEngine(sc.app);
  const { state } = replay(engine, events);
  const file: ReplayFile = {
    version: 1,
    app: sc.app.id,
    origin: 'synthetic',
    description: sc.description,
    lang,
    events,
    expected: {
      decisions: state.decisions.map((d) => ({
        raw: d.raw,
        outcome: d.outcome,
        ...(d.resolution.status === 'resolved' ? { bindings: d.resolution.bindings as Record<string, unknown> } : {}),
      })),
      finalApp: state.doc.app,
    },
  };
  const path = `${DIR}/${sc.name}.replay.json`;
  if (existsSync(path) && JSON.parse(readFileSync(path, 'utf8')).origin === 'recorded') {
    console.log(`skip ${path} (recorded session)`);
    continue;
  }
  writeFileSync(path, JSON.stringify(file, null, 1));
  console.log(`${path}: ${file.expected!.decisions!.map((d) => `${d.raw} -> ${d.outcome}`).join(' | ')}`);
}
