import fc from 'fast-check';
import { describe, it } from 'vitest';
import { arbScene, numRuns } from '@hocus/testkit';
import { setup } from './helpers.ts';

describe('P12 destructive bulk actions never run without confirmation (fusion-engine 5.5)', () => {
  it('"delete these" over 2+ objects waits for yes/Enter; timeouts, cancels and unrelated input never delete', () => {
    fc.assert(
      fc.property(
        arbScene(2, 6),
        fc.integer({ min: 2, max: 6 }),
        fc.array(fc.constantFrom('tick', 'cancel', 'stop', 'florp', 'undo', 'redo'), { maxLength: 5 }),
        fc.boolean(),
        (objects, k, noise, confirmAtEnd) => {
          const { engine } = setup(objects);
          const ids = objects.slice(0, Math.min(k, objects.length)).map((o) => o.id);
          let s = engine.initial();
          let t = 100;
          s = engine.step(s, { type: 'lasso', t, ids }).state;
          s = engine.step(s, { type: 'speech', speech: { t: (t += 50), kind: 'typed', text: 'delete these', lang: 'en' } }).state;
          let cancelled = false;
          for (const n of noise) {
            t += 3000;
            if (n === 'tick') s = engine.step(s, { type: 'tick', t }).state;
            else s = engine.step(s, { type: 'speech', speech: { t, kind: 'typed', text: n, lang: 'en' } }).state;
            if (s.phase.kind !== 'confirm') cancelled = true;
            if (s.doc.app.order.length !== objects.length) return false;
          }
          if (confirmAtEnd) {
            s = engine.step(s, { type: 'key', t: t + 10, intent: 'confirm' }).state;
            return cancelled ? s.doc.app.order.length === objects.length : s.doc.app.order.length === objects.length - ids.length;
          }
          s = engine.step(s, { type: 'tick', t: t + 60_000 }).state;
          return s.doc.app.order.length === objects.length;
        },
      ),
      { numRuns: numRuns() },
    );
  });
});
