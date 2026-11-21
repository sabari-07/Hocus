import fc from 'fast-check';
import { describe, it } from 'vitest';
import { EMPTY_SPOT, arbJitter, arbScene, centerOf, numRuns } from '@hocus/testkit';
import { boundId, frameFor, pathSamples, resolveWith } from './helpers.ts';

describe('P01 a stable dwell near the word binds that object (fusion-engine 2.1)', () => {
  it('binds the dwelled object when it was the target for >= 250 ms in the 800 ms before the word', () => {
    fc.assert(
      fc.property(
        arbScene(),
        fc.nat(),
        fc.integer({ min: 250, max: 1200 }),
        fc.integer({ min: 0, max: 550 }),
        fc.double({ min: 0.6, max: 1, noNaN: true }),
        arbJitter,
        (objects, pick, dwell, wordOffset, conf, jitter) => {
          const target = objects[pick % objects.length]!;
          const t0 = 10_000;
          // Come from empty space, dwell on the target, leave to empty space.
          const samples = pathSamples(
            objects,
            t0,
            [
              { ...EMPTY_SPOT, hold: 300 },
              { ...centerOf(target), hold: dwell, move: 150, jitter },
              { ...EMPTY_SPOT, hold: 1500, move: 150 },
            ],
            conf,
          );
          const dwellStart = t0 + 300 + 150;
          const dwellEnd = dwellStart + dwell;
          // The word comes 250..800 ms after the dwell began, so the dwell covers >= 250 ms of [tWord - 800, tWord].
          const tWord = dwellStart + 250 + wordOffset;
          void dwellEnd;
          const frame = frameFor(objects, 'make that bigger', [tWord]);
          const res = resolveWith(objects, frame, samples, { tFinal: tWord + 400 });
          return boundId(res, 'target') === target.id;
        },
      ),
      { numRuns: numRuns() },
    );
  });
});
