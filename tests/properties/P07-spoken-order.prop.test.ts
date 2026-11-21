import fc from 'fast-check';
import { describe, it } from 'vitest';
import { EMPTY_SPOT, arbJitter, arbScene, centerOf, numRuns } from '@hocus/testkit';
import { boundId, frameFor, pathSamples, resolveWith } from './helpers.ts';

describe('P07 several pointing words bind in spoken order (fusion-engine 2.7)', () => {
  it('"compare this with that" binds this -> first dwell, that -> second dwell, never swapped', () => {
    fc.assert(
      fc.property(
        arbScene(2, 6),
        fc.nat(),
        fc.nat(),
        fc.integer({ min: 400, max: 900 }),
        fc.integer({ min: 400, max: 900 }),
        fc.integer({ min: 0, max: 120 }),
        arbJitter,
        (objects, i, j, d1, d2, lateness, jitter) => {
          const a = objects[i % objects.length]!;
          const rest = objects.filter((o) => o.id !== a.id);
          const b = rest[j % rest.length]!;
          const t0 = 1_000;
          const samples = pathSamples(objects, t0, [
            { ...EMPTY_SPOT, hold: 200 },
            { ...centerOf(a), hold: d1, move: 120, jitter },
            { ...centerOf(b), hold: d2, move: 120, jitter },
            { ...EMPTY_SPOT, hold: 1200, move: 120 },
          ]);
          const aEnd = t0 + 200 + 120 + d1;
          const bEnd = aEnd + 120 + d2;
          // "this" spoken near the end of the first dwell, "that" near the end of the second.
          const tThis = aEnd - 150 + lateness;
          const tThat = bEnd - 150 + lateness;
          const res = resolveWith(objects, frameFor(objects, 'compare this with that', [tThis, tThat]), samples, { tFinal: tThat + 400 });
          return boundId(res, 'a') === a.id && boundId(res, 'b') === b.id;
        },
      ),
      { numRuns: numRuns() },
    );
  });
});
