import fc from 'fast-check';
import { describe, it } from 'vitest';
import { DEFAULT_CONFIG, nudgeLag } from '@hocus/core';
import { numRuns } from '@hocus/testkit';

describe('P20 self-calibration stays within bounds and converges on a consistent offset (fusion-engine 6.5, 6.6)', () => {
  it('any sequence of targets keeps the lag in [lagMin, lagMax]', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -5000, max: 5000 }), { maxLength: 50 }), fc.double({ min: 0, max: 1, noNaN: true }), (targets, rate) => {
        const cfg = { ...DEFAULT_CONFIG, calibrationRate: rate };
        let lag = cfg.lagMs;
        for (const t of targets) {
          lag = nudgeLag(lag, t, cfg);
          if (lag < cfg.lagMin || lag > cfg.lagMax) return false;
        }
        return true;
      }),
      { numRuns: numRuns() },
    );
  });

  it('a consistent in-range target is approached monotonically', () => {
    fc.assert(
      fc.property(fc.integer({ min: DEFAULT_CONFIG.lagMin, max: DEFAULT_CONFIG.lagMax }), fc.integer({ min: 1, max: 30 }), (target, n) => {
        let lag = DEFAULT_CONFIG.lagMs;
        let prev = Math.abs(lag - target);
        for (let i = 0; i < n; i++) {
          lag = nudgeLag(lag, target, DEFAULT_CONFIG);
          const d = Math.abs(lag - target);
          if (d > prev + 1e-9) return false;
          prev = d;
        }
        return prev <= Math.abs(DEFAULT_CONFIG.lagMs - target) * Math.pow(1 - DEFAULT_CONFIG.calibrationRate, n) + 1e-6;
      }),
      { numRuns: numRuns() },
    );
  });
});
