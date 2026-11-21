import fc from 'fast-check';
import { describe, it } from 'vitest';
import { replay, type HocusEvent } from '@hocus/core';
import { EMPTY_SPOT, arbScene, centerOf, mergeEvents, numRuns, pointerEvents, samplesFromPath, utteranceEvents, waypointPath } from '@hocus/testkit';
import { setup } from './helpers.ts';

const CASES = [
  { text: 'make that bigger', action: 'scale', args: (id: string) => ({ target: id, factor: 1.25 }) },
  { text: 'make that smaller', action: 'scale', args: (id: string) => ({ target: id, factor: 0.8 }) },
  { text: 'rotate that', action: 'rotate', args: (id: string) => ({ target: id }) },
  { text: 'turn that red', action: 'recolor', args: (id: string) => ({ target: id, color: 'red' }), needs: 'colorable' },
];

describe('P13 everything doable by voice + pointing is doable with keyboard and mouse only (a11y, app-sdk 3.2)', () => {
  it('voice+pointing, click+typed, and the keyboard actions menu all produce the same document', () => {
    fc.assert(
      fc.property(arbScene(), fc.nat(), fc.constantFrom(...CASES), (objects, i, c) => {
        const pool = objects.filter((o) => !c.needs || o.caps.includes(c.needs));
        if (!pool.length) return true;
        const target = pool[i % pool.length]!;
        const { engine } = setup(objects);
        // 1. voice + pointing
        const path = waypointPath(1000, [
          { ...centerOf(target), hold: 1000 },
          { ...EMPTY_SPOT, hold: 1200, move: 150 },
        ]);
        const voice = replay(
          engine,
          mergeEvents(pointerEvents(samplesFromPath(path, objects)), utteranceEvents(c.text, 1500, [2050], 2300), [{ type: 'tick', t: 4000 }]),
        ).state.doc.app;
        // 2. click to select + typed command (no pointer samples at all)
        const typed = replay(engine, [
          { type: 'select', t: 100, ids: [target.id], mode: 'replace' },
          { type: 'speech', speech: { t: 200, kind: 'typed', text: c.text, lang: 'en' } },
          { type: 'tick', t: 1000 },
        ] as HocusEvent[]).state.doc.app;
        // 3. keyboard actions menu
        const menu = replay(engine, [{ type: 'command', t: 100, action: c.action, args: c.args(target.id) }]).state.doc.app;
        return JSON.stringify(voice) === JSON.stringify(typed) && JSON.stringify(typed) === JSON.stringify(menu);
      }),
      { numRuns: numRuns() },
    );
  });
});
