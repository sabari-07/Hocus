import fc from 'fast-check';
import { describe, it } from 'vitest';
import { replay } from '@hocus/core';
import { numRuns } from '@hocus/testkit';
import { setup } from './helpers.ts';
import { arbLog } from './P06-replay-determinism.prop.test.ts';

describe('P18 replaying the first n events equals the state after n steps (fusion-engine 1.4)', () => {
  it('fold(prefix) === step-by-step state at n, for every n', () => {
    fc.assert(
      fc.property(arbLog, fc.nat(), ({ objects, events }, nSeed) => {
        const { engine } = setup(objects);
        const n = events.length ? nSeed % (events.length + 1) : 0;
        let s = engine.initial();
        for (let i = 0; i < n; i++) s = engine.step(s, events[i]!).state;
        const folded = replay(engine, events.slice(0, n)).state;
        return JSON.stringify(folded) === JSON.stringify(s);
      }),
      { numRuns: numRuns() },
    );
  });
});
