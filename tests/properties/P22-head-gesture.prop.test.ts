import fc from 'fast-check';
import { describe, it } from 'vitest';
import { numRuns } from '@hocus/testkit';
import { detectHeadGesture, type NoseSample } from '../../packages/vision/src/pose.ts';

function oscillation(axis: 'x' | 'y', amp: number, periodMs: number, ms: number): NoseSample[] {
  const out: NoseSample[] = [];
  for (let t = 0; t <= ms; t += 33) {
    const s = Math.sin((2 * Math.PI * t) / periodMs) * amp;
    out.push({ t, x: 0.5 + (axis === 'x' ? s : 0), y: 0.5 + (axis === 'y' ? s : 0) });
  }
  return out;
}

describe('P22 a clear vertical head oscillation is a nod and a clear horizontal one is a shake, never both (pointer-input 7.1, 7.2, 7.3)', () => {
  it('classifies by axis for any amplitude, period and direction', () => {
    fc.assert(
      fc.property(fc.integer({ min: 24, max: 80 }), fc.integer({ min: 450, max: 700 }), fc.boolean(), (ampMilli, period, vertical) => {
        const g = detectHeadGesture(oscillation(vertical ? 'y' : 'x', ampMilli / 1000, period, 1250));
        return g === (vertical ? 'nod' : 'shake');
      }),
      { numRuns: numRuns() },
    );
  });

  it('a steady drift at any speed never fires (head pointing is not a gesture)', () => {
    fc.assert(
      fc.property(fc.double({ min: -0.5, max: 0.5, noNaN: true }), fc.double({ min: -0.5, max: 0.5, noNaN: true }), (vx, vy) => {
        const path: NoseSample[] = [];
        for (let t = 0; t <= 1300; t += 33) path.push({ t, x: 0.5 + (vx * t) / 1000, y: 0.5 + (vy * t) / 1000 });
        return detectHeadGesture(path) === null;
      }),
      { numRuns: numRuns() },
    );
  });
});
