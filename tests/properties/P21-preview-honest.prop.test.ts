import fc from 'fast-check';
import { describe, it } from 'vitest';
import { replay } from '@hocus/core';
import { arbScene, centerOf, mergeEvents, numRuns, pointerEvents, samplesFromPath, waypointPath } from '@hocus/testkit';
import { setup } from './helpers.ts';

const TEXTS = ['make that bigger', 'turn this green', 'rotate that', 'delete these', 'compare this with that', 'florp', 'make it smaller'];

describe('P21 live preview is pure and honest (fusion-engine 7.4, 7.5, 7.6)', () => {
  it('preview never changes state, and a typed command resolves exactly as its preview said', () => {
    fc.assert(
      fc.property(
        arbScene(2, 6),
        fc.array(fc.record({ i: fc.nat(), hold: fc.integer({ min: 60, max: 700 }), move: fc.integer({ min: 30, max: 250 }) }), { minLength: 1, maxLength: 5 }),
        fc.constantFrom(...TEXTS),
        (objects, tour, text) => {
          const { engine } = setup(objects);
          const path = waypointPath(1000, tour.map((w) => ({ ...centerOf(objects[w.i % objects.length]!), hold: w.hold, move: w.move })));
          const { state } = replay(engine, mergeEvents(pointerEvents(samplesFromPath(path, objects))));
          const before = JSON.stringify(state);
          const t = state.t + 10;
          const pv = engine.preview(state, text, t, true);
          engine.liveEvidence(state, t);
          if (JSON.stringify(state) !== before) return false;
          const after = engine.step(state, { type: 'speech', speech: { t, kind: 'typed', text, lang: 'en' } }).state;
          const rec = after.decisions.at(-1);
          if (pv.kind !== 'frame') return pv.kind === 'none' ? rec?.outcome === 'no_action' : true;
          if (!rec) return false;
          const want = pv.resolution;
          const got = rec.resolution;
          if (want.status !== got.status) return false;
          return want.status !== 'resolved' || JSON.stringify(want.bindings) === JSON.stringify(got.status === 'resolved' ? got.bindings : null);
        },
      ),
      { numRuns: numRuns() },
    );
  });
});
