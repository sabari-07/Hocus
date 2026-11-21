import fc from 'fast-check';
import { describe, it } from 'vitest';
import { replay, type HocusEvent } from '@hocus/core';
import { arbScene, centerOf, mergeEvents, numRuns, pointerEvents, samplesFromPath, waypointPath } from '@hocus/testkit';
import { setup } from './helpers.ts';

const TEXTS = ['make that bigger', 'put it there', 'turn this green', 'undo', 'no the other one', 'yes', 'stop', 'delete these', 'compare this with that', 'florp'];

/** A random but valid event log: a pointer tour plus utterances, keys and ticks at random times. */
export const arbLog = arbScene().chain((objects) =>
  fc
    .record({
      tour: fc.array(fc.record({ i: fc.nat(), hold: fc.integer({ min: 50, max: 700 }), move: fc.integer({ min: 30, max: 300 }) }), { minLength: 1, maxLength: 6 }),
      talk: fc.array(
        fc.record({ text: fc.constantFrom(...TEXTS), at: fc.integer({ min: 0, max: 4000 }), typed: fc.boolean() }),
        { minLength: 1, maxLength: 5 },
      ),
      keys: fc.array(fc.record({ intent: fc.constantFrom('confirm', 'cancel', 'undo', 'redo' as const), at: fc.integer({ min: 0, max: 4000 }) }), { maxLength: 3 }),
      ticks: fc.array(fc.integer({ min: 0, max: 6000 }), { maxLength: 6 }),
    })
    .map(({ tour, talk, keys, ticks }) => {
      const path = waypointPath(
        1000,
        tour.map((w) => ({ ...centerOf(objects[w.i % objects.length]!), hold: w.hold, move: w.move })),
      );
      const speech: HocusEvent[] = talk.flatMap((u): HocusEvent[] =>
        u.typed
          ? [{ type: 'speech', speech: { t: 1000 + u.at, kind: 'typed', text: u.text, lang: 'en' } }]
          : [
              { type: 'speech', speech: { t: 1000 + u.at, kind: 'start', lang: 'en' } },
              { type: 'speech', speech: { t: 1000 + u.at + 300, kind: 'interim', text: u.text.split(' ').slice(0, 2).join(' '), lang: 'en' } },
              { type: 'speech', speech: { t: 1000 + u.at + 600, kind: 'final', text: u.text, lang: 'en' } },
            ],
      );
      const other: HocusEvent[] = [
        ...keys.map((k): HocusEvent => ({ type: 'key', t: 1000 + k.at, intent: k.intent })),
        ...ticks.map((t): HocusEvent => ({ type: 'tick', t: 1000 + t })),
      ];
      return { objects, events: mergeEvents(pointerEvents(samplesFromPath(path, objects)), speech, other) };
    }),
);

describe('P06 the same event log always gives the same result (fusion-engine 1.3)', () => {
  it('folding a log twice yields identical state, effects and decisions', () => {
    fc.assert(
      fc.property(arbLog, ({ objects, events }) => {
        const { engine } = setup(objects);
        const a = replay(engine, events);
        const b = replay(engine, events);
        return JSON.stringify(a) === JSON.stringify(b);
      }),
      { numRuns: numRuns() },
    );
  });
});
