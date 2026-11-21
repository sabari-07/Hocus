import fc from 'fast-check';
import { describe, it } from 'vitest';
import { parse } from '@hocus/core';
import { arbScene, numRuns } from '@hocus/testkit';
import { setup } from './helpers.ts';

describe('P05 unknown words never change state and never crash (fusion-engine 1.6, lexicon-parser 1.4)', () => {
  it('any text: step never throws; text that parses to no_action leaves the document unchanged', () => {
    fc.assert(
      fc.property(
        arbScene(),
        fc.oneof(fc.string({ maxLength: 60 }), fc.string({ unit: 'grapheme', maxLength: 30 }), fc.array(fc.constantFrom('xyzzy', 'florp', 'gleeb', 'wub'), { maxLength: 6 }).map((w) => w.join(' '))),
        fc.constantFrom('en', 'hi', 'ta'),
        fc.boolean(),
        (objects, text, lang, typed) => {
          const { engine } = setup(objects);
          let s = { ...engine.initial(), lang: lang as 'en' | 'hi' | 'ta' };
          const parsed = parse(text, engine.parseContext(s));
          s = engine.step(s, { type: 'speech', speech: { t: 100, kind: typed ? 'typed' : 'final', text, lang: s.lang } }).state;
          s = engine.step(s, { type: 'tick', t: 20_000 }).state;
          if (parsed.type === 'no_action') return JSON.stringify(s.doc) === JSON.stringify(engine.initial().doc);
          return true;
        },
      ),
      { numRuns: numRuns() },
    );
  });
});
