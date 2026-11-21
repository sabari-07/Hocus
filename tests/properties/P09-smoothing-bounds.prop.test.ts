import fc from 'fast-check';
import { describe, it } from 'vitest';
import { oneEuroInit, oneEuroStep } from '@hocus/core';
import { numRuns } from '@hocus/testkit';

describe('P09 the smoothing filter never overshoots the input range (pointer-input 2.3)', () => {
  it('every One Euro output lies within [min, max] of the inputs seen so far', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ v: fc.double({ min: -5000, max: 5000, noNaN: true }), dt: fc.integer({ min: 1, max: 200 }) }), { minLength: 1, maxLength: 200 }),
        fc.record({ minCutoff: fc.double({ min: 0.05, max: 10, noNaN: true }), beta: fc.double({ min: 0, max: 1, noNaN: true }), dCutoff: fc.double({ min: 0.1, max: 5, noNaN: true }) }),
        (inputs, params) => {
          let st = oneEuroInit();
          let t = 0;
          let lo = Infinity;
          let hi = -Infinity;
          for (const { v, dt } of inputs) {
            t += dt;
            lo = Math.min(lo, v);
            hi = Math.max(hi, v);
            const [out, next] = oneEuroStep(st, v, t, params);
            st = next;
            const eps = 1e-9 * Math.max(1, Math.abs(lo), Math.abs(hi));
            if (out < lo - eps || out > hi + eps) return false;
          }
          return true;
        },
      ),
      { numRuns: numRuns() },
    );
  });
});
