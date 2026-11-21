import fc from 'fast-check';
import {
  defineApp,
  type AppDefinition,
  type Hit,
  type HocusEvent,
  type PlaceArg,
  type PointerSample,
  type Rect,
  type Selectable,
  type SurfacePoint,
} from '@hocus/core';

export { simulateUser, type SimUserOptions, type SimTrial } from './simulate.ts';

/** Property-test run count. `FC_RUNS` env overrides (CI nightly uses thousands). */
export function numRuns(): number {
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
  const v = Number(g.process?.env?.FC_RUNS ?? '');
  return Number.isFinite(v) && v > 0 ? v : 100;
}

// ---------------------------------------------------------------- a tiny test app

export interface SimObject {
  id: string;
  label: string;
  kind: string;
  caps: string[];
  rect: Rect;
}

export interface TestObjState {
  scale: number;
  color: string;
  pos: { x: number; y: number; z: number };
  rotation: number;
}

export interface TestState {
  objects: Record<string, TestObjState>;
  order: string[];
  created: number;
}

const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** A small app with the generic verbs, used by property tests and the benchmark. */
export function makeTestApp(objects: readonly SimObject[]): AppDefinition<TestState> {
  const byId = new Map(objects.map((o) => [o.id, o]));
  const initial: TestState = {
    objects: Object.fromEntries(
      objects.map((o) => [o.id, { scale: 1, color: 'white', pos: { x: center(o.rect).x / 100, y: 0, z: center(o.rect).y / 100 }, rotation: 0 }]),
    ),
    order: objects.map((o) => o.id),
    created: 0,
  };
  const upd = (s: TestState, id: string, f: (o: TestObjState) => TestObjState): TestState =>
    s.objects[id] ? { ...s, objects: { ...s.objects, [id]: f(s.objects[id]!) } } : s;
  return defineApp<TestState>({
    id: 'testkit',
    title: 'Testkit',
    initialState: initial,
    entities: { block: { label: 'Block', caps: ['scalable', 'colorable'] } },
    selectables: (s) =>
      s.order
        .filter((id) => s.objects[id])
        .map((id): Selectable => {
          const o = byId.get(id);
          const st = s.objects[id]!;
          return { id, label: o?.label ?? id, kind: o?.kind ?? 'block', caps: o?.caps ?? ['scalable', 'colorable'], pos: st.pos, size: st.scale };
        }),
    actions: {
      scale: {
        slots: { target: 'object', factor: 'factor' },
        defaults: { factor: 1.25 },
        requires: 'scalable',
        reduce: (s, a) => upd(s, String(a.target), (o) => ({ ...o, scale: o.scale * Number(a.factor ?? 1.25) })),
        examples: { en: ['make that bigger'] },
      },
      recolor: {
        slots: { target: 'object', color: 'color' },
        requires: 'colorable',
        reduce: (s, a) => upd(s, String(a.target), (o) => ({ ...o, color: String(a.color) })),
        examples: { en: ['turn this green'] },
      },
      move: {
        slots: { target: 'object', destination: 'place' },
        reduce: (s, a) => {
          const p = a.destination as PlaceArg;
          return upd(s, String(a.target), (o) => ({ ...o, pos: p.world ?? { x: p.x / 100, y: 0, z: p.y / 100 } }));
        },
        examples: { en: ['put it there'] },
      },
      rotate: {
        slots: { target: 'object' },
        reduce: (s, a) => upd(s, String(a.target), (o) => ({ ...o, rotation: (o.rotation + 45) % 360 })),
        examples: { en: ['rotate that'] },
      },
      compare: {
        slots: { a: 'object', b: 'object' },
        distinct: true,
        mutates: false,
        reduce: (s) => s,
        respond: (_s, a, ctx) => `${ctx.labelOf(String(a.a))} vs ${ctx.labelOf(String(a.b))}`,
        examples: { en: ['compare this with that'] },
      },
      delete: {
        slots: { targets: 'objects' },
        destructive: true,
        reduce: (s, a) => {
          const ids = new Set(a.targets as string[]);
          const objectsLeft = Object.fromEntries(Object.entries(s.objects).filter(([id]) => !ids.has(id)));
          return { ...s, objects: objectsLeft, order: s.order.filter((id) => !ids.has(id)) };
        },
        examples: { en: ['delete these'] },
      },
      place: {
        slots: { what: 'entityType', where: 'place' },
        reduce: (s, a) => {
          const id = `new-${s.created + 1}`;
          const p = a.where as PlaceArg;
          return {
            ...s,
            created: s.created + 1,
            order: [...s.order, id],
            objects: { ...s.objects, [id]: { scale: 1, color: 'white', pos: p.world ?? { x: 0, y: 0, z: 0 }, rotation: 0 } },
          };
        },
        examples: { en: ['put a block there'] },
      },
      reset: {
        slots: {},
        alwaysConfirm: true,
        reduce: () => initial,
        examples: { en: ['start over'] },
      },
    },
    vocabulary: {
      en: { nouns: { block: ['block', 'blocks', 'box', 'boxes'] } },
      hi: { nouns: { block: ['ब्लॉक', 'डिब्बा'] } },
      ta: { nouns: { block: ['கட்டை', 'பெட்டி'] } },
    },
  });
}

// ---------------------------------------------------------------- hit testing and paths

export function hitsAt(objects: readonly SimObject[], x: number, y: number, margin = 12): Hit[] {
  const hits: Hit[] = [];
  for (const o of objects) {
    const r = o.rect;
    const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
    const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
    const d = Math.hypot(dx, dy);
    const quality = d === 0 ? 1 : d >= margin ? 0 : 1 - d / margin;
    if (quality > 0) hits.push({ id: o.id, quality });
  }
  return hits;
}

export interface PathPoint {
  t: number;
  x: number;
  y: number;
}

export function samplesFromPath(
  path: readonly PathPoint[],
  objects: readonly SimObject[],
  opts: { conf?: number; source?: PointerSample['source']; margin?: number; surface?: boolean; aperture?: number } = {},
): PointerSample[] {
  return path.map((p) => {
    const hits = hitsAt(objects, p.x, p.y, opts.margin ?? 12);
    const place: SurfacePoint | undefined =
      opts.surface === false ? undefined : { surface: 'floor', world: { x: p.x / 100, y: 0, z: p.y / 100 } };
    return {
      t: p.t,
      x: p.x,
      y: p.y,
      conf: opts.conf ?? 1,
      source: opts.source ?? 'mouse',
      pose: 'point',
      hits,
      ...(place ? { place } : {}),
      ...(opts.aperture != null ? { aperture: opts.aperture } : {}),
    };
  });
}

/** Piecewise path: hold at each waypoint for `hold` ms, moving between waypoints in `move` ms, sampled at `hz`. */
export function waypointPath(
  t0: number,
  points: ReadonlyArray<{ x: number; y: number; hold: number; move?: number; jitter?: ReadonlyArray<number> }>,
  hz = 30,
): PathPoint[] {
  const dt = 1000 / hz;
  const out: PathPoint[] = [];
  let t = t0;
  let prev: { x: number; y: number } | null = null;
  for (const p of points) {
    if (prev && (p.move ?? 0) > 0) {
      const steps = Math.max(1, Math.round((p.move ?? 0) / dt));
      for (let i = 1; i <= steps; i++) {
        const f = i / steps;
        out.push({ t, x: prev.x + (p.x - prev.x) * f, y: prev.y + (p.y - prev.y) * f });
        t += dt;
      }
    }
    const holdSteps = Math.max(1, Math.round(p.hold / dt));
    for (let i = 0; i < holdSteps; i++) {
      const j = p.jitter?.length ? p.jitter[i % p.jitter.length]! : 0;
      out.push({ t, x: p.x + j, y: p.y - j });
      t += dt;
    }
    prev = p;
  }
  return out.map((q) => ({ t: Math.round(q.t * 1000) / 1000, x: q.x, y: q.y }));
}

export const centerOf = (o: SimObject) => center(o.rect);

/** Events for a spoken utterance with one interim per timed word at `seenTimes[k]`. */
export function utteranceEvents(text: string, startT: number, seenTimes: readonly number[], finalT: number, lang: 'en' | 'hi' | 'ta' = 'en'): HocusEvent[] {
  const words = text.split(/\s+/);
  const ev: HocusEvent[] = [{ type: 'speech', speech: { t: startT, kind: 'start', lang } }];
  seenTimes.forEach((st, k) => {
    // Interim text grows; we only need it to contain k+1 timed words, so give it progressively more words.
    const upto = Math.min(words.length, Math.ceil(((k + 1) / seenTimes.length) * words.length));
    ev.push({ type: 'speech', speech: { t: st, kind: 'interim', text: words.slice(0, upto).join(' '), lang } });
  });
  ev.push({ type: 'speech', speech: { t: finalT, kind: 'final', text, lang } });
  ev.push({ type: 'speech', speech: { t: finalT + 1, kind: 'end', lang } });
  return ev;
}

export function pointerEvents(samples: readonly PointerSample[]): HocusEvent[] {
  return samples.map((sample) => ({ type: 'pointer', sample }));
}

/** Merge event streams by time (stable). */
export function mergeEvents(...streams: HocusEvent[][]): HocusEvent[] {
  const all = streams.flat().map((e, i) => ({ e, i, t: e.type === 'pointer' ? e.sample.t : e.type === 'speech' ? e.speech.t : e.t }));
  all.sort((a, b) => a.t - b.t || a.i - b.i);
  return all.map((x) => x.e);
}

// ---------------------------------------------------------------- arbitraries

/** 2..6 non-overlapping objects on a 1280x720 stage, each at least 56 px, laid out on a jittered grid. */
export function arbScene(min = 2, max = 6): fc.Arbitrary<SimObject[]> {
  return fc
    .record({
      n: fc.integer({ min, max }),
      sizes: fc.array(fc.integer({ min: 56, max: 140 }), { minLength: 6, maxLength: 6 }),
      offs: fc.array(fc.integer({ min: 0, max: 40 }), { minLength: 12, maxLength: 12 }),
      colorable: fc.array(fc.boolean(), { minLength: 6, maxLength: 6 }),
    })
    .map(({ n, sizes, offs, colorable }) =>
      Array.from({ length: n }, (_, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const s = sizes[i]!;
        return {
          id: `obj-${i + 1}`,
          label: `Object ${i + 1}`,
          kind: 'block',
          caps: colorable[i] ? ['scalable', 'colorable'] : ['scalable'],
          rect: { x: 160 + col * 360 + offs[i]!, y: 120 + row * 300 + offs[i + 6]!, w: s, h: s },
        };
      }),
    );
}

/** A point that is guaranteed to be on empty stage (no object within margin). */
export const EMPTY_SPOT = { x: 40, y: 690 };

export const arbJitter = fc.array(fc.integer({ min: -3, max: 3 }), { minLength: 1, maxLength: 8 });
