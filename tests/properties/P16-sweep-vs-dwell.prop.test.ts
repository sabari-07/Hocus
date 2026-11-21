import fc from 'fast-check';
import { describe, it } from 'vitest';
import { DEFAULT_CONFIG, prepareSamples, scoreCandidates, type PointerSample } from '@hocus/core';
import { numRuns, type SimObject } from '@hocus/testkit';

/**
 * Two wide objects. The pointer dwells (near-still) on A for D ms and sweeps fast across B for the
 * same D ms of in-object time, both inside the plateau of the time weight. A must always win.
 */
const A: SimObject = { id: 'A', label: 'A', kind: 'block', caps: [], rect: { x: 100, y: 100, w: 400, h: 100 } };
const B: SimObject = { id: 'B', label: 'B', kind: 'block', caps: [], rect: { x: 100, y: 400, w: 4000, h: 100 } };

describe('P16 a fast sweep never beats a stable dwell of equal duration (fusion-engine 2.5)', () => {
  it('dwell evidence > sweep evidence for any duration, jitter and sweep speed >= 1.5 px/ms', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 280 }),
        fc.double({ min: 1.5, max: 6, noNaN: true }),
        fc.integer({ min: 0, max: 2 }),
        fc.boolean(),
        (D, speed, jitter, sweepFirst) => {
          const dt = 1000 / 30;
          const samples: PointerSample[] = [];
          let t = 0;
          const seg = (kind: 'dwell' | 'sweep') => {
            const n = Math.round(D / dt);
            for (let i = 0; i < n; i++) {
              const x = kind === 'dwell' ? 300 + (i % 2 ? jitter : -jitter) : 120 + i * speed * dt;
              const y = kind === 'dwell' ? 150 : 450;
              samples.push({ t, x, y, conf: 1, source: 'hand', pose: 'point', hits: [{ id: kind === 'dwell' ? 'A' : 'B', quality: 1 }] });
              t += dt;
            }
          };
          if (sweepFirst) {
            seg('sweep');
            seg('dwell');
          } else {
            seg('dwell');
            seg('sweep');
          }
          // Word right after both segments: both lie in the plateau [-650, -50].
          const tWord = t + 60;
          if (t > 600) return true;
          const ranked = scoreCandidates(prepareSamples(samples, DEFAULT_CONFIG), DEFAULT_CONFIG, {
            tWord,
            window: [tWord - 800, tWord + 300],
            flat: false,
            candidates: [
              { id: 'A', label: 'A', kind: 'block', caps: [] },
              { id: 'B', label: 'B', kind: 'block', caps: [] },
            ],
          });
          const ea = ranked.find((c) => c.id === 'A')?.evidence ?? 0;
          const eb = ranked.find((c) => c.id === 'B')?.evidence ?? 0;
          void A;
          void B;
          return ea > eb;
        },
      ),
      { numRuns: numRuns() },
    );
  });
});
