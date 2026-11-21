import fc from 'fast-check';
import { describe, it } from 'vitest';
import type { Doc } from '@hocus/core';
import { arbScene, numRuns } from '@hocus/testkit';
import { setup } from './helpers.ts';

function consistent(doc: Doc<unknown>): boolean {
  // Every name points at exactly one id, every id has at most one name, display mirrors names.
  const owners = Object.entries(doc.names);
  const ids = owners.map(([, id]) => id);
  if (new Set(ids).size !== ids.length) return false;
  for (const [name, id] of owners) if (doc.display[id]?.toLowerCase() !== name) return false;
  for (const [id, disp] of Object.entries(doc.display)) if (doc.names[disp.toLowerCase()] !== id) return false;
  return true;
}

describe('P19 names stay unique and consistent through undo and redo (fusion-engine 4.3, 4.4)', () => {
  it('any sequence of naming, undo and redo keeps names unique and display in sync', () => {
    fc.assert(
      fc.property(
        arbScene(2, 6),
        fc.array(
          fc.oneof(
            fc.record({ op: fc.constant('name' as const), i: fc.nat(), name: fc.constantFrom('Boris', 'boris', 'Mina', 'Ravi', 'Kali') }),
            fc.record({ op: fc.constantFrom('undo' as const, 'redo' as const) }),
          ),
          { maxLength: 20 },
        ),
        (objects, ops) => {
          const { engine } = setup(objects);
          let s = engine.initial();
          let t = 0;
          const history = [s.doc];
          for (const o of ops) {
            t += 10;
            if (o.op === 'name') {
              const id = objects[o.i % objects.length]!.id;
              s = engine.step(s, { type: 'command', t, action: '__name', args: { target: id, name: o.name } }).state;
              history.push(s.doc);
              if (engine.labelOf(s, id) !== o.name) return false;
            } else s = engine.step(s, { type: 'key', t, intent: o.op }).state;
            if (!consistent(s.doc as Doc<unknown>)) return false;
            if (!history.some((d) => JSON.stringify(d) === JSON.stringify(s.doc))) return false;
          }
          return true;
        },
      ),
      { numRuns: numRuns() },
    );
  });
});
