import fc from 'fast-check';
import { describe, it } from 'vitest';
import { replay } from '@hocus/core';
import { EMPTY_SPOT, arbScene, mergeEvents, numRuns, pointerEvents, samplesFromPath, utteranceEvents, waypointPath } from '@hocus/testkit';
import { setup } from './helpers.ts';

const COMMANDS = ['make that bigger', 'turn this green', 'rotate that', 'make this smaller', 'compare this with that'];

describe('P04 no pointing evidence gives no_target and no state change (fusion-engine 2.4)', () => {
  it('pointing only at empty space never changes the document', () => {
    fc.assert(
      fc.property(arbScene(), fc.constantFrom(...COMMANDS), fc.integer({ min: 500, max: 3000 }), (objects, text, hold) => {
        const { engine } = setup(objects);
        const path = waypointPath(1000, [{ ...EMPTY_SPOT, hold }]);
        const ev = mergeEvents(
          pointerEvents(samplesFromPath(path, objects)),
          utteranceEvents(text, 1000 + hold / 2, [1000 + hold / 2 + 300], 1000 + hold + 100),
          [{ type: 'tick', t: 1000 + hold + 2000 }],
        );
        const { state } = replay(engine, ev);
        const last = state.decisions.at(-1);
        return JSON.stringify(state.doc) === JSON.stringify(engine.initial().doc) && last?.outcome === 'no_target';
      }),
      { numRuns: numRuns() },
    );
  });
});
