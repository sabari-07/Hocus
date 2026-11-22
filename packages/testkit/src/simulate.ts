import { createRng, type HocusEvent, type PointerSample } from '@hocus/core';
import { hitsAt, type SimObject } from './index.ts';

/**
 * A simulated user for the benchmark (docs/benchmark.md). Synthetic, seeded and reproducible.
 * The user moves to a target, dwells, says a command containing a deictic word while still
 * pointing (or just after moving on), with recognizer lag and hand jitter drawn from ranges.
 */
export interface SimUserOptions {
  seed: number;
  objects: SimObject[];
  /** Hand jitter amplitude in px (after smoothing). */
  jitter: number;
  /** Tracker confidence. */
  conf: number;
  /** True recognizer lag range (ms) between speaking a word and its first interim. */
  lagRange: [number, number];
  /** Probability the user has already started moving to the next spot when the word is spoken. */
  earlyLeave: number;
  /** Dwell before speaking, ms range. */
  dwellRange: [number, number];
  hz: number;
}

export interface SimTrial {
  events: HocusEvent[];
  target: string;
  /** Actual time the deictic word was spoken. */
  tWordTrue: number;
  /** First interim time containing the word. */
  seenT: number;
  finalT: number;
  samples: PointerSample[];
}

export function simulateUser(o: SimUserOptions, trialIndex: number, t0: number): SimTrial {
  const rng = createRng(o.seed * 7919 + trialIndex);
  const objs = o.objects;
  const target = objs[rng.int(0, objs.length - 1)]!;
  const others = objs.filter((x) => x.id !== target.id);
  const decoy = others.length ? others[rng.int(0, others.length - 1)]! : target;
  const c = (x: SimObject) => ({ x: x.rect.x + x.rect.w / 2, y: x.rect.y + x.rect.h / 2 });
  const dt = 1000 / o.hz;
  const samples: PointerSample[] = [];
  let t = t0;
  const push = (x: number, y: number) => {
    const jx = (rng.next() * 2 - 1) * o.jitter;
    const jy = (rng.next() * 2 - 1) * o.jitter;
    const px = x + jx;
    const py = y + jy;
    samples.push({
      t,
      x: px,
      y: py,
      conf: o.conf,
      source: 'hand',
      pose: 'point',
      hits: hitsAt(objs, px, py),
      place: { surface: 'floor', world: { x: px / 100, y: 0, z: py / 100 } },
    });
    t += dt;
  };
  const moveTo = (from: { x: number; y: number }, to: { x: number; y: number }, ms: number) => {
    const n = Math.max(1, Math.round(ms / dt));
    for (let i = 1; i <= n; i++) push(from.x + ((to.x - from.x) * i) / n, from.y + ((to.y - from.y) * i) / n);
  };
  const hold = (p: { x: number; y: number }, ms: number) => {
    const n = Math.max(1, Math.round(ms / dt));
    for (let i = 0; i < n; i++) push(p.x, p.y);
  };
  // Start near the decoy (people often come from another object), move to target, dwell.
  const start = c(decoy);
  hold(start, rng.int(150, 500));
  moveTo(start, c(target), rng.int(180, 380));
  const dwell = rng.int(o.dwellRange[0], o.dwellRange[1]);
  const dwellStart = t;
  hold(c(target), dwell);
  // The word is spoken near the end of the dwell; sometimes the hand leaves early.
  const leaves = rng.next() < o.earlyLeave;
  const tWordTrue = leaves ? t - rng.int(0, 150) : dwellStart + dwell * (0.5 + rng.next() * 0.5);
  // After speaking: keep pointing (40%), drift to empty space (30%) or move to another object (30%).
  const roll = rng.next();
  const away = roll < 0.4 ? c(target) : roll < 0.7 ? { x: 40, y: 690 } : c(others.length ? others[rng.int(0, others.length - 1)]! : target);
  moveTo(c(target), away, rng.int(200, 400));
  hold(away, 600);
  const lag = rng.int(o.lagRange[0], o.lagRange[1]);
  const seenT = tWordTrue + lag;
  const finalT = Math.max(seenT + 250, t - 300);
  const events: HocusEvent[] = [];
  const speech: HocusEvent[] = [
    { type: 'speech', speech: { t: tWordTrue - 400, kind: 'start', lang: 'en' } },
    { type: 'speech', speech: { t: seenT, kind: 'interim', text: 'make that', lang: 'en' } },
    { type: 'speech', speech: { t: finalT, kind: 'final', text: 'make that bigger', lang: 'en' } },
    { type: 'speech', speech: { t: finalT + 1, kind: 'end', lang: 'en' } },
  ];
  const all = [...samples.map((sample) => ({ type: 'pointer', sample }) as HocusEvent), ...speech];
  all.sort((a, b) => time(a) - time(b));
  events.push(...all);
  return { events, target: target.id, tWordTrue, seenT, finalT, samples };
}

const time = (e: HocusEvent) => (e.type === 'pointer' ? e.sample.t : e.type === 'speech' ? e.speech.t : e.t);
