import fc from 'fast-check';
import { describe, it } from 'vitest';
import { DEFAULT_CONFIG } from '@hocus/core';
import { EMPTY_SPOT, arbScene, centerOf, numRuns } from '@hocus/testkit';
import { boundId, frameFor, pathSamples, resolveWith } from './helpers.ts';

describe('P11 "it" resolves to the last acted-on object unless fresh pointing is stronger (fusion-engine 4.1, 4.2)', () => {
  it('weak or no pointing -> memory; strong unambiguous pointing -> the pointed object', () => {
    fc.assert(
      fc.property(arbScene(2, 6), fc.nat(), fc.nat(), fc.integer({ min: 0, max: 900 }), (objects, i, j, dwell) => {
        const remembered = objects[i % objects.length]!;
        const rest = objects.filter((o) => o.id !== remembered.id);
        const pointed = rest[j % rest.length]!;
        const t0 = 1_000;
        const pts = [{ ...EMPTY_SPOT, hold: 300 }];
        if (dwell > 0) pts.push({ ...centerOf(pointed), hold: dwell, move: 80 } as never);
        pts.push({ ...EMPTY_SPOT, hold: 800, move: 80 } as never);
        const samples = pathSamples(objects, t0, pts);
        const tWord = t0 + 300 + 80 + dwell;
        const res = resolveWith(objects, frameFor(objects, 'make it bigger', [tWord]), samples, { tFinal: tWord + 300, lastActed: [remembered.id] });
        const word = res.words[0];
        const fresh = word?.candidates.find((c) => c.id === pointed.id)?.evidence ?? 0;
        const expected = fresh >= DEFAULT_CONFIG.itOverrideEvidence ? pointed.id : remembered.id;
        return boundId(res, 'target') === expected;
      }),
      { numRuns: numRuns() },
    );
  });
});
