import { describe, expect, it } from 'vitest';
import { OneEuro2D, detectLoop, pointInPolygon, rectFractionInPolygon, selectInLoop, spatialPlace, type PointerSample } from '@hocus/core';
import { makeTestApp, type SimObject } from '@hocus/testkit';
import { frameFor, resolveWith } from '../properties/helpers.ts';

const objects: SimObject[] = [
  { id: 'a', label: 'Pumpkin', kind: 'block', caps: ['scalable', 'colorable'], rect: { x: 100, y: 100, w: 80, h: 80 } },
  { id: 'b', label: 'Ghost', kind: 'block', caps: ['scalable'], rect: { x: 500, y: 100, w: 80, h: 80 } },
  { id: 'c', label: 'Bat', kind: 'block', caps: ['scalable', 'colorable'], rect: { x: 900, y: 100, w: 80, h: 80 } },
];
const still = (t0: number, ms: number, id: string | null, extra: Partial<PointerSample> = {}): PointerSample[] =>
  Array.from({ length: Math.round(ms / 33) }, (_, i) => ({ t: t0 + i * 33, x: 300, y: 300, conf: 1, source: 'hand', pose: 'point', hits: id ? [{ id, quality: 1 }] : [], ...extra }));

describe('resolver paths (fusion-engine 3, 4)', () => {
  it('place word binds the surface point under the steadiest sample near the word', () => {
    const samples = still(1000, 600, null, { place: { surface: 'floor', world: { x: 2, y: 0, z: 3 } } });
    const r = resolveWith(objects, frameFor(objects, 'put it there', [1500, 1500]), samples, { tFinal: 1800, lastActed: ['a'] });
    expect(r.status).toBe('resolved');
    if (r.status === 'resolved') {
      expect(r.bindings.target).toEqual({ kind: 'object', id: 'a' });
      expect(r.bindings.destination).toMatchObject({ kind: 'place', world: { x: 2, y: 0, z: 3 }, surface: 'floor' });
    }
  });

  it('place word with no surface samples -> no_target on the place slot', () => {
    const r = resolveWith(objects, frameFor(objects, 'put it there', [1500, 1500]), still(1000, 600, null), { tFinal: 1800, lastActed: ['a'] });
    expect(r).toMatchObject({ status: 'no_target', slot: 'destination' });
  });

  it('"every block" binds all objects of that kind; "the bat" binds by kind when unique', () => {
    const all = resolveWith(objects, frameFor(objects, 'delete every block', []), [], { tFinal: 1000 });
    expect(all).toMatchObject({ status: 'resolved', bindings: { targets: { kind: 'objects', ids: ['a', 'b', 'c'] } } });
    const named = resolveWith(objects, frameFor(objects, 'make the bat bigger', []), [], { tFinal: 1000 });
    expect(named).toMatchObject({ status: 'resolved', bindings: { target: { kind: 'object', id: 'c' } } });
  });

  it('"these" without a lasso binds every object that individually reaches the minimum evidence', () => {
    const samples = [...still(1000, 300, 'a'), ...still(1300, 300, 'c')];
    const r = resolveWith(objects, frameFor(objects, 'delete these', [1650]), samples, { tFinal: 1900 });
    expect(r.status).toBe('resolved');
    if (r.status === 'resolved') expect([...(r.bindings.targets as { ids: string[] }).ids].sort()).toEqual(['a', 'c']);
  });

  it('plural with nothing pointed and nothing selected -> no_target; with a selection -> the selection', () => {
    expect(resolveWith(objects, frameFor(objects, 'delete these', [1500]), still(1000, 600, null), { tFinal: 1800 }).status).toBe('no_target');
    const sel = resolveWith(objects, frameFor(objects, 'delete these', [1500]), still(1000, 600, null), { tFinal: 1800, selection: ['b', 'c'] });
    expect(sel).toMatchObject({ status: 'resolved', bindings: { targets: { kind: 'objects', ids: ['b', 'c'] } } });
  });

  it('spatial words resolve the reference first, then place relative to it', () => {
    const samples = still(1000, 600, 'b');
    const r = resolveWith(objects, frameFor(objects, 'put it next to this', [1500, 1500]), samples, { tFinal: 1800, lastActed: ['a'] });
    expect(r.status).toBe('resolved');
    if (r.status === 'resolved') {
      const d = r.bindings.destination as { kind: string; world: { x: number; z: number }; surface: string };
      expect(d.surface).toBe('spatial');
      // Ghost centre is at x=5.4 (540/100) with size 1 -> next to = x + 1.2*1 + 0.2
      expect(d.world.x).toBeCloseTo(5.4 + 1.4, 6);
    }
  });

  it('implicit object ("make bigger") falls back to memory, then to no_target', () => {
    expect(resolveWith(objects, frameFor(objects, 'make bigger', []), [], { tFinal: 1000, lastActed: ['c'] })).toMatchObject({ status: 'resolved', bindings: { target: { kind: 'object', id: 'c' } } });
    expect(resolveWith(objects, frameFor(objects, 'make bigger', []), [], { tFinal: 1000 }).status).toBe('no_target');
  });

  it('distinct slots never bind the same object twice ("compare this with that" while pointing at one thing)', () => {
    const r = resolveWith(objects, frameFor(objects, 'compare this with that', [1300, 1500]), still(1000, 600, 'a'), { tFinal: 1800 });
    if (r.status === 'resolved') expect(r.bindings.a).not.toEqual(r.bindings.b);
    else expect(['no_target', 'ask']).toContain(r.status);
  });

  it('the test app reducers keep unrelated objects untouched', () => {
    const app = makeTestApp(objects);
    const s = app.actions.scale!.reduce(app.initialState, { target: 'a', factor: 2 }, { labelOf: (x) => x, lang: 'en', selectables: [] });
    expect(s.objects.a!.scale).toBe(2);
    expect(s.objects.b).toBe(app.initialState.objects.b);
  });
});

describe('geometry and smoothing helpers', () => {
  const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  it('pointInPolygon and rect fraction', () => {
    expect(pointInPolygon({ x: 50, y: 50 }, square)).toBe(true);
    expect(pointInPolygon({ x: 150, y: 50 }, square)).toBe(false);
    expect(rectFractionInPolygon({ x: 0, y: 0, w: 100, h: 100 }, square)).toBe(1);
    expect(rectFractionInPolygon({ x: 50, y: 0, w: 100, h: 100 }, square)).toBeCloseTo(3 / 7, 6);
    expect(rectFractionInPolygon({ x: 0, y: 0, w: 0, h: 10 }, square)).toBe(0);
    expect(selectInLoop(square, [{ id: 'in', rect: { x: 10, y: 10, w: 20, h: 20 } }, { id: 'half', rect: { x: 50, y: 0, w: 100, h: 100 } }])).toEqual(['in']);
  });
  it('detectLoop finds a closed circle and ignores an open stroke', () => {
    const circle = Array.from({ length: 40 }, (_, i) => ({ t: i * 33, x: 200 + Math.cos((i / 39) * Math.PI * 2) * 80, y: 200 + Math.sin((i / 39) * Math.PI * 2) * 80 }));
    expect(detectLoop(circle)?.length).toBeGreaterThan(20);
    const line = Array.from({ length: 40 }, (_, i) => ({ t: i * 33, x: i * 10, y: 0 }));
    expect(detectLoop(line)).toBeNull();
    expect(detectLoop(circle.slice(0, 5))).toBeNull();
  });
  it('spatialPlace offsets for every relation', () => {
    const ref = [{ pos: { x: 0, y: 1, z: 0 }, size: 1 }];
    expect(spatialPlace('leftOf', ref)).toEqual({ x: -1.4, y: 1, z: 0 });
    expect(spatialPlace('rightOf', ref)).toEqual({ x: 1.4, y: 1, z: 0 });
    expect(spatialPlace('onTopOf', ref)).toEqual({ x: 0, y: 2, z: 0 });
    expect(spatialPlace('inFrontOf', ref)).toEqual({ x: 0, y: 1, z: 1.4 });
    expect(spatialPlace('behind', ref)).toEqual({ x: 0, y: 1, z: -1.4 });
    expect(spatialPlace('between', [...ref, { pos: { x: 4, y: 1, z: 2 }, size: 1 }])).toEqual({ x: 2, y: 1, z: 1 });
    expect(spatialPlace('between', ref)).toBeNull();
    expect(spatialPlace('nextTo', [])).toBeNull();
  });
  it('OneEuro2D passes the first sample through, smooths after, and resets', () => {
    const f = new OneEuro2D();
    expect(f.filter(10, 20, 0)).toEqual([10, 20]);
    const [x] = f.filter(110, 20, 33);
    expect(x).toBeGreaterThan(10);
    expect(x).toBeLessThan(110);
    f.reset();
    expect(f.filter(500, 500, 100)).toEqual([500, 500]);
  });
});
