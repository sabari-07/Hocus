import fc from 'fast-check';
import { describe, it } from 'vitest';
import { EMPTY_SPOT, arbJitter, arbScene, centerOf, numRuns } from '@hocus/testkit';
import { boundId, frameFor, pathSamples, resolveWith } from './helpers.ts';

describe('P02 small shifts of the word time do not change the binding (fusion-engine 2.6)', () => {
  it('shifting tWord by up to 100 ms inside one long dwell keeps the same object', () => {
    fc.assert(
      fc.property(arbScene(), fc.nat(), fc.integer({ min: -100, max: 100 }), arbJitter, (objects, pick, shift, jitter) => {
        const target = objects[pick % objects.length]!;
        const t0 = 5_000;
        const samples = pathSamples(objects, t0, [
          { ...EMPTY_SPOT, hold: 200 },
          { ...centerOf(target), hold: 1600, move: 150, jitter },
          { ...EMPTY_SPOT, hold: 1000, move: 150 },
        ]);
        const dwellStart = t0 + 350;
        const tWord = dwellStart + 900; // window [100, 1200] after dwell start, all inside the dwell
        const a = resolveWith(objects, frameFor(objects, 'make that bigger', [tWord]), samples, { tFinal: tWord + 500 });
        const b = resolveWith(objects, frameFor(objects, 'make that bigger', [tWord + shift]), samples, { tFinal: tWord + 500 });
        return boundId(a, 'target') === target.id && boundId(b, 'target') === target.id;
      }),
      { numRuns: numRuns() },
    );
  });
});
