import fc from 'fast-check';
import { describe, it } from 'vitest';
import type { HocusEvent } from '@hocus/core';
import { arbScene, numRuns } from '@hocus/testkit';
import { setup } from './helpers.ts';

/** Model-based: a random sequence of keyboard-path commands, then undo k times, equals the k-th earlier document. */
describe('P08 apply then undo restores the exact previous state (fusion-engine 5.4)', () => {
  it('undo k times returns the document from k steps ago; redo walks forward again', () => {
    fc.assert(
      fc.property(
        arbScene(),
        fc.array(
          fc.record({
            op: fc.constantFrom('scale', 'recolor', 'rotate', 'move', 'delete', '__name'),
            i: fc.nat(),
            f: fc.constantFrom(0.5, 0.8, 1.25, 2),
            color: fc.constantFrom('red', 'green', 'blue'),
            x: fc.integer({ min: 0, max: 1200 }),
            name: fc.constantFrom('Boris', 'Mina', 'Ravi'),
          }),
          { minLength: 1, maxLength: 12 },
        ),
        fc.nat(),
        (objects, ops, kSeed) => {
          const { engine } = setup(objects);
          let s = engine.initial();
          const docs = [s.doc];
          let t = 100;
          for (const o of ops) {
            const ids = engine.selectables(s).map((x) => x.id);
            if (!ids.length) break;
            const id = ids[o.i % ids.length]!;
            const args: Record<string, unknown> =
              o.op === 'scale'
                ? { target: id, factor: o.f }
                : o.op === 'recolor'
                  ? { target: id, color: o.color }
                  : o.op === 'move'
                    ? { target: id, destination: { x: o.x, y: 300, world: { x: o.x / 100, y: 0, z: 3 } } }
                    : o.op === 'delete'
                      ? { targets: [id] }
                      : o.op === '__name'
                        ? { target: id, name: o.name }
                        : { target: id };
            const ev: HocusEvent = { type: 'command', t: (t += 10), action: o.op, args };
            s = engine.step(s, ev).state;
            docs.push(s.doc);
          }
          const n = docs.length - 1;
          const k = n === 0 ? 0 : (kSeed % n) + 1;
          let u = s;
          for (let i = 0; i < k; i++) u = engine.step(u, { type: 'key', t: (t += 10), intent: 'undo' }).state;
          if (JSON.stringify(u.doc) !== JSON.stringify(docs[n - k])) return false;
          for (let i = 0; i < k; i++) u = engine.step(u, { type: 'key', t: (t += 10), intent: 'redo' }).state;
          return JSON.stringify(u.doc) === JSON.stringify(docs[n]);
        },
      ),
      { numRuns: numRuns() },
    );
  });
});
