import fc from 'fast-check';
import { describe, it } from 'vitest';
import { DEFAULT_CONFIG, prepareSamples, scoreCandidates } from '@hocus/core';
import { EMPTY_SPOT, arbScene, centerOf, numRuns } from '@hocus/testkit';
import { boundId, frameFor, pathSamples, resolveWith, setup } from './helpers.ts';

describe('P15 type constraints only ever remove candidates (fusion-engine 4.5)', () => {
  it('candidates under a capability filter are a subset, with identical evidence', () => {
    fc.assert(
      fc.property(
        arbScene(2, 6),
        fc.array(fc.record({ i: fc.nat(), hold: fc.integer({ min: 50, max: 500 }) }), { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 0, max: 3000 }),
        (objects, tour, offset) => {
          const { engine } = setup(objects);
          const all = engine.selectables(engine.initial());
          const colorable = all.filter((s) => s.caps.includes('colorable'));
          const samples = pathSamples(objects, 1000, [
            { ...EMPTY_SPOT, hold: 100 },
            ...tour.map((w) => ({ ...centerOf(objects[w.i % objects.length]!), hold: w.hold, move: 80 })),
          ]);
          const prepared = prepareSamples(samples, DEFAULT_CONFIG);
          const tWord = 1000 + offset;
          const o = { tWord, window: [tWord - 800, tWord + 300] as [number, number], flat: false };
          const full = scoreCandidates(prepared, DEFAULT_CONFIG, { ...o, candidates: all });
          const filtered = scoreCandidates(prepared, DEFAULT_CONFIG, { ...o, candidates: colorable });
          return filtered.every((c) => {
            const twin = full.find((f) => f.id === c.id);
            return !!twin && Math.abs(twin.evidence - c.evidence) < 1e-12 && colorable.some((x) => x.id === c.id);
          });
        },
      ),
      { numRuns: numRuns() },
    );
  });

  it('"turn that red" never binds an object that lacks the colorable capability', () => {
    fc.assert(
      fc.property(arbScene(2, 6), fc.nat(), fc.integer({ min: 300, max: 900 }), (objects, i, dwell) => {
        const target = objects[i % objects.length]!;
        const samples = pathSamples(objects, 1000, [
          { ...EMPTY_SPOT, hold: 200 },
          { ...centerOf(target), hold: dwell, move: 100 },
          { ...EMPTY_SPOT, hold: 800, move: 100 },
        ]);
        const tWord = 1000 + 300 + dwell - 100;
        const res = resolveWith(objects, frameFor(objects, 'turn that red', [tWord]), samples, { tFinal: tWord + 300 });
        const id = boundId(res, 'target');
        if (!target.caps.includes('colorable')) return id !== target.id;
        return id === target.id;
      }),
      { numRuns: numRuns() },
    );
  });
});
