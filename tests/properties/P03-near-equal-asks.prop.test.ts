import fc from 'fast-check';
import { describe, it } from 'vitest';
import { EMPTY_SPOT, arbScene, centerOf, numRuns } from '@hocus/testkit';
import { frameFor, pathSamples, resolveWith } from './helpers.ts';

describe('P03 near-equal evidence asks, never guesses (fusion-engine 2.3)', () => {
  it('equal stable dwells on two objects inside the plateau produce an ask that offers both', () => {
    fc.assert(
      fc.property(arbScene(2, 6), fc.nat(), fc.nat(), fc.integer({ min: 200, max: 260 }), fc.integer({ min: -8, max: 8 }), (objects, i, j, dwell, delta) => {
        const a = objects[i % objects.length]!;
        const others = objects.filter((o) => o.id !== a.id);
        const b = others[j % others.length]!;
        const t0 = 20_000;
        // Both dwells sit inside the plateau [-650, -50] of the time weight: same weight, same duration (+-8 ms).
        const tWord = t0 + 200 + 40 + dwell + 40 + dwell + delta + 100;
        const samples = pathSamples(objects, t0, [
          { ...EMPTY_SPOT, hold: 200 },
          { ...centerOf(a), hold: dwell, move: 40 },
          { ...centerOf(b), hold: dwell + delta, move: 40 },
          { ...EMPTY_SPOT, hold: 1000, move: 40 },
        ]);
        const res = resolveWith(objects, frameFor(objects, 'make that bigger', [tWord]), samples, { tFinal: tWord + 400 });
        if (res.status !== 'ask') return false;
        const ids = res.options.map((o) => o.id);
        return ids.includes(a.id) && ids.includes(b.id);
      }),
      { numRuns: numRuns() },
    );
  });
});
