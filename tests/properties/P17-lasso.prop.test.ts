import fc from 'fast-check';
import { describe, it } from 'vitest';
import { pointInPolygon, rectFractionInPolygon, selectInLoop, type Point2, type Rect } from '@hocus/core';
import { numRuns } from '@hocus/testkit';

/** A star-shaped loop around a centre: radii per angle step. */
const arbLoop = fc
  .record({
    cx: fc.integer({ min: 300, max: 900 }),
    cy: fc.integer({ min: 200, max: 500 }),
    radii: fc.array(fc.integer({ min: 80, max: 260 }), { minLength: 6, maxLength: 16 }),
  })
  .map(({ cx, cy, radii }) =>
    radii.map((r, i): Point2 => {
      const a = (i / radii.length) * Math.PI * 2;
      return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
    }),
  );

const arbRects = fc.array(
  fc.record({ x: fc.integer({ min: 0, max: 1200 }), y: fc.integer({ min: 0, max: 700 }), w: fc.integer({ min: 20, max: 160 }), h: fc.integer({ min: 20, max: 160 }) }),
  { minLength: 1, maxLength: 8 },
);

const corners = (r: Rect): Point2[] => [
  { x: r.x, y: r.y },
  { x: r.x + r.w, y: r.y },
  { x: r.x, y: r.y + r.h },
  { x: r.x + r.w, y: r.y + r.h },
];

describe('P17 a lasso selects only objects mostly inside the loop (fusion-engine 3.5)', () => {
  it('selected objects are >= ~50% inside (fine oracle); objects far outside are never selected', () => {
    fc.assert(
      fc.property(arbLoop, arbRects, (loop, rects) => {
        const objs = rects.map((rect, i) => ({ id: `r${i}`, rect }));
        const selected = new Set(selectInLoop(loop, objs, 0.6));
        const xs = loop.map((p) => p.x);
        const ys = loop.map((p) => p.y);
        const bbox = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
        for (const o of objs) {
          const fine = rectFractionInPolygon(o.rect, loop, 24);
          if (selected.has(o.id) && fine < 0.5) return false;
          const outside = o.rect.x > bbox.x1 || o.rect.x + o.rect.w < bbox.x0 || o.rect.y > bbox.y1 || o.rect.y + o.rect.h < bbox.y0;
          if (outside && selected.has(o.id)) return false;
          // A rect whose 4 corners and centre are inside a star-shaped loop is mostly inside.
          const allIn = [...corners(o.rect), { x: o.rect.x + o.rect.w / 2, y: o.rect.y + o.rect.h / 2 }].every((p) => pointInPolygon(p, loop));
          if (allIn && fine > 0.9 && !selected.has(o.id)) return false;
        }
        return true;
      }),
      { numRuns: numRuns() },
    );
  });
});
