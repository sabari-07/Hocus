import fc from 'fast-check';
import { describe, it } from 'vitest';
import { parse } from '@hocus/core';
import { numRuns, type SimObject } from '@hocus/testkit';
import { setup } from './helpers.ts';

const objects: SimObject[] = [
  { id: 'a', label: 'Lantern', kind: 'block', caps: ['scalable', 'colorable'], rect: { x: 0, y: 0, w: 60, h: 60 } },
];

/** A small generative grammar: every sentence it produces has a known expected frame. */
const det = fc.constantFrom('this', 'that');
const polite = fc.constantFrom('', 'please ', 'hocus ', 'could you ');
const color = fc.constantFrom('red', 'green', 'blue', 'purple', 'gold');
const up = fc.constantFrom('bigger', 'larger');
const down = fc.constantFrom('smaller', 'tinier');

const sentence = fc.oneof(
  fc.tuple(polite, det, up).map(([p, d, u]) => ({ text: `${p}make ${d} ${u}`, action: 'scale', factor: 1.25, color: undefined as string | undefined })),
  fc.tuple(polite, det, down).map(([p, d, u]) => ({ text: `${p}make ${d} ${u}`, action: 'scale', factor: 0.8, color: undefined })),
  fc.tuple(polite, fc.constantFrom('turn', 'paint', 'color'), det, color).map(([p, v, d, c]) => ({ text: `${p}${v} ${d} ${c}`, action: 'recolor', factor: undefined, color: c })),
  fc.tuple(polite, fc.constantFrom('move', 'put'), fc.constantFrom('it', 'that', 'this'), fc.constantFrom('here', 'there', 'over there')).map(([p, v, d, w]) => ({ text: `${p}${v} ${d} ${w}`, action: 'move', factor: undefined, color: undefined })),
  fc.tuple(polite, det, det).map(([p, a, b]) => ({ text: `${p}compare ${a} with ${b}`, action: 'compare', factor: undefined, color: undefined })),
  fc.tuple(polite, fc.constantFrom('delete', 'remove', 'erase'), fc.constantFrom('these', 'those', 'them')).map(([p, v, d]) => ({ text: `${p}${v} ${d}`, action: 'delete', factor: undefined, color: undefined })),
  fc.tuple(polite, fc.constantFrom('rotate', 'spin', 'twist'), det).map(([p, v, d]) => ({ text: `${p}${v} ${d}`, action: 'rotate', factor: undefined, color: undefined })),
);

describe('P10 every grammar sentence parses to its expected frame; random text never throws (lexicon-parser 1.1, 1.4)', () => {
  const { engine } = setup(objects);
  const ctx = engine.parseContext(engine.initial());

  it('generated sentences round-trip to the expected action and literals', () => {
    fc.assert(
      fc.property(sentence, fc.constantFrom('', '.', '!', ' please'), (s, tail) => {
        const r = parse(s.text + tail, ctx);
        if (r.type !== 'frame' || r.frame.action !== s.action) return false;
        if (s.factor !== undefined && (r.frame.slots.factor as { value?: number } | undefined)?.value !== s.factor) return false;
        if (s.color !== undefined && (r.frame.slots.color as { value?: string } | undefined)?.value !== s.color) return false;
        return true;
      }),
      { numRuns: numRuns() },
    );
  });

  it('random text never throws', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme', maxLength: 80 }), (text) => {
        parse(text, ctx);
        return true;
      }),
      { numRuns: numRuns() },
    );
  });
});
