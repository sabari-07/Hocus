import fc from 'fast-check';
import { describe, it } from 'vitest';
import { parse, type CommandFrame, type SlotValue } from '@hocus/core';
import { numRuns, type SimObject } from '@hocus/testkit';
import { setup } from './helpers.ts';

const objects: SimObject[] = [{ id: 'a', label: 'X', kind: 'block', caps: ['scalable', 'colorable'], rect: { x: 0, y: 0, w: 60, h: 60 } }];

/** Token sets that form a command in any order in Hindi and Tamil (SOV, case-marked). */
const COMMANDS: Array<{ lang: 'hi' | 'ta'; tokens: string[]; action: string }> = [
  { lang: 'hi', tokens: ['इसे', 'लाल', 'करो'], action: 'recolor' },
  { lang: 'hi', tokens: ['उसे', 'बड़ा', 'करो'], action: 'scale' },
  { lang: 'hi', tokens: ['इसे', 'घुमाओ'], action: 'rotate' },
  { lang: 'hi', tokens: ['इन्हें', 'हटाओ'], action: 'delete' },
  { lang: 'ta', tokens: ['இதை', 'பச்சையாக்கு'], action: 'recolor' },
  { lang: 'ta', tokens: ['அதை', 'பெரிதாக்கு'], action: 'scale' },
  { lang: 'ta', tokens: ['இதை', 'சுழற்று'], action: 'rotate' },
  { lang: 'ta', tokens: ['இவற்றை', 'நீக்கு'], action: 'delete' },
];

/** Compare frames ignoring token positions. */
function shape(f: CommandFrame) {
  const norm = (v: SlotValue): unknown =>
    v.type === 'deictic' ? { type: v.type, role: v.role, word: v.word } : v.type === 'anaphor' ? { type: v.type, word: v.word } : v;
  return { action: f.action, slots: Object.fromEntries(Object.entries(f.slots).map(([k, v]) => [k, norm(v)])) };
}

describe('P14 in free-word-order languages, reordering tokens gives the same frame (lexicon-parser 2.2)', () => {
  it('every permutation of a Hindi/Tamil command parses to the same action and slots', () => {
    fc.assert(
      fc.property(fc.constantFrom(...COMMANDS), fc.array(fc.nat(), { minLength: 4, maxLength: 4 }), (cmd, seeds) => {
        const { engine } = setup(objects);
        const ctx = engine.parseContext({ ...engine.initial(), lang: cmd.lang });
        const base = parse(cmd.tokens.join(' '), ctx);
        // Fisher-Yates driven by the generated seeds (shrinkable).
        const perm = [...cmd.tokens];
        for (let i = perm.length - 1; i > 0; i--) {
          const j = seeds[i % seeds.length]! % (i + 1);
          [perm[i], perm[j]] = [perm[j]!, perm[i]!];
        }
        const shuffled = parse(perm.join(' '), ctx);
        if (base.type !== 'frame' || shuffled.type !== 'frame') return false;
        return base.frame.action === cmd.action && JSON.stringify(shape(base.frame)) === JSON.stringify(shape(shuffled.frame));
      }),
      { numRuns: numRuns() },
    );
  });
});
