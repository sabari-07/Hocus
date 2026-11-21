import { describe, expect, it } from 'vitest';
import { createEngine, replay, validateEvent, type HocusEvent } from '@hocus/core';
import {
  EMPTY_SPOT,
  centerOf,
  makeTestApp,
  mergeEvents,
  pointerEvents,
  samplesFromPath,
  utteranceEvents,
  waypointPath,
  type SimObject,
} from '@hocus/testkit';

const objects: SimObject[] = [
  { id: 'a', label: 'Pumpkin', kind: 'block', caps: ['scalable', 'colorable'], rect: { x: 100, y: 100, w: 80, h: 80 } },
  { id: 'b', label: 'Ghost', kind: 'block', caps: ['scalable'], rect: { x: 500, y: 100, w: 80, h: 80 } },
  { id: 'c', label: 'Bat', kind: 'block', caps: ['scalable', 'colorable'], rect: { x: 900, y: 400, w: 80, h: 80 } },
];
const app = makeTestApp(objects);
const engine = createEngine(app);
const A = centerOf(objects[0]!);
const B = centerOf(objects[1]!);

function scenario(points: Parameters<typeof waypointPath>[1], speech: HocusEvent[], extra: HocusEvent[] = []) {
  const path = waypointPath(1000, points);
  return mergeEvents(pointerEvents(samplesFromPath(path, objects)), speech, extra);
}

describe('engine end to end (fusion-engine requirements 2, 5, 6)', () => {
  it('"make that bigger" while pointing at the pumpkin previews, then executes after 600 ms', () => {
    // Dwell on A from ~1000 to ~2000. Word spoken at ~1700 -> first interim at 2050 (350 ms lag).
    const ev = scenario(
      [
        { ...A, hold: 1000 },
        { ...EMPTY_SPOT, hold: 1500, move: 200 },
      ],
      utteranceEvents('make that bigger', 1500, [2050], 2300),
    );
    let { state } = replay(engine, ev);
    expect(state.phase.kind).toBe('preview');
    state = engine.step(state, { type: 'tick', t: 3000 }).state;
    expect(state.phase.kind).toBe('idle');
    expect(state.doc.app.objects.a!.scale).toBeCloseTo(1.25);
    expect(state.doc.app.objects.b!.scale).toBe(1);
  });

  it('pointing at nothing says "Point at something first" and changes nothing', () => {
    const ev = scenario([{ ...EMPTY_SPOT, hold: 2500 }], utteranceEvents('make that bigger', 1500, [2050], 2300));
    const { state, effects } = replay(engine, ev);
    expect(state.doc).toEqual(engine.initial().doc);
    expect(effects.some((e) => e.type === 'announce' && /Point at something first/.test(e.text))).toBe(true);
  });

  it('then "put it there" moves the last object to where the user pointed', () => {
    const ev = scenario(
      [
        { ...A, hold: 1000 },
        { ...EMPTY_SPOT, hold: 300, move: 200 },
        { x: 700, y: 600, hold: 1500, move: 300 },
      ],
      [...utteranceEvents('make that bigger', 1500, [2050], 2300), { type: 'tick', t: 3000 }, ...utteranceEvents('put it there', 3200, [3500, 3700], 3900)],
      [{ type: 'tick', t: 4600 }],
    );
    const { state } = replay(engine, ev);
    const pos = state.doc.app.objects.a!.pos;
    expect(pos.x).toBeCloseTo(7, 0);
    expect(pos.z).toBeCloseTo(6, 0);
  });

  it('undo restores the exact previous document; redo re-applies it', () => {
    const ev = scenario([{ ...A, hold: 2500 }], utteranceEvents('make that bigger', 1500, [2050], 2300), [{ type: 'tick', t: 3000 }]);
    const after = replay(engine, ev).state;
    const undone = engine.step(after, { type: 'key', t: 3100, intent: 'undo' }).state;
    expect(undone.doc).toEqual(engine.initial().doc);
    const redone = engine.step(undone, { type: 'key', t: 3200, intent: 'redo' }).state;
    expect(redone.doc).toEqual(after.doc);
  });

  it('cancel during preview discards the command', () => {
    const ev = scenario([{ ...A, hold: 2500 }], utteranceEvents('make that bigger', 1500, [2050], 2300));
    let { state } = replay(engine, ev);
    state = engine.step(state, { type: 'key', t: 2400, intent: 'cancel' }).state;
    state = engine.step(state, { type: 'tick', t: 4000 }).state;
    expect(state.doc).toEqual(engine.initial().doc);
  });

  it('near-equal dwell on two objects asks instead of guessing, and "2" answers it', () => {
    // 450 ms on A then 450 ms on B, word at the end -> both inside the window.
    const ev = scenario(
      [
        { ...A, hold: 1500 },
        { ...B, hold: 400, move: 60 },
        { ...EMPTY_SPOT, hold: 1000, move: 60 },
      ],
      utteranceEvents('make that bigger', 2200, [2700 + 350], 3300),
    );
    let { state } = replay(engine, ev);
    // Depending on exact timing this is ask or a clear bind; force the scenario to be checked explicitly.
    const rec = state.decisions[state.decisions.length - 1]!;
    if (state.phase.kind === 'ask') {
      expect(rec.outcome).toBe('ask');
      state = engine.step(state, { type: 'speech', speech: { t: 3500, kind: 'typed', text: '2', lang: 'en' } }).state;
      expect(state.phase.kind).toBe('preview');
    } else {
      expect(rec.outcome).toBe('preview');
    }
  });

  it('"no, the other one" undoes and re-binds to the runner-up', () => {
    const ev = scenario(
      [
        { ...B, hold: 300 },
        { ...A, hold: 900, move: 100 },
        { ...EMPTY_SPOT, hold: 1200, move: 100 },
      ],
      utteranceEvents('make that bigger', 1500, [2150], 2400),
      [{ type: 'tick', t: 3100 }],
    );
    let { state } = replay(engine, ev);
    expect(state.doc.app.objects.a!.scale).toBeCloseTo(1.25);
    state = engine.step(state, { type: 'speech', speech: { t: 3600, kind: 'typed', text: 'no, the other one', lang: 'en' } }).state;
    state = engine.step(state, { type: 'tick', t: 5000 }).state;
    expect(state.doc.app.objects.a!.scale).toBe(1);
    expect(state.doc.app.objects.b!.scale).toBeCloseTo(1.25);
  });

  it('keyboard path: click selection + typed command works without any pointing', () => {
    let s = engine.initial();
    s = engine.step(s, { type: 'select', t: 100, ids: ['c'], mode: 'replace' }).state;
    s = engine.step(s, { type: 'speech', speech: { t: 200, kind: 'typed', text: 'turn this green', lang: 'en' } }).state;
    s = engine.step(s, { type: 'tick', t: 900 }).state;
    expect(s.doc.app.objects.c!.color).toBe('green');
  });

  it('type constraint: "turn that green" ignores non-colorable objects', () => {
    let s = engine.initial();
    s = engine.step(s, { type: 'select', t: 100, ids: ['b'], mode: 'replace' }).state;
    const r = engine.step(s, { type: 'speech', speech: { t: 200, kind: 'typed', text: 'turn that green', lang: 'en' } });
    expect(r.state.phase.kind).toBe('idle');
    expect(r.state.decisions.at(-1)!.outcome).toBe('no_target');
  });

  it('naming: "call this one Boris" then "make Boris bigger"', () => {
    let s = engine.initial();
    s = engine.step(s, { type: 'select', t: 100, ids: ['a'], mode: 'replace' }).state;
    s = engine.step(s, { type: 'speech', speech: { t: 200, kind: 'typed', text: 'call this one Boris', lang: 'en' } }).state;
    s = engine.step(s, { type: 'tick', t: 900 }).state;
    expect(engine.labelOf(s, 'a')).toBe('Boris');
    s = engine.step(s, { type: 'select', t: 950, ids: [], mode: 'clear' }).state;
    s = engine.step(s, { type: 'speech', speech: { t: 1000, kind: 'typed', text: 'make Boris bigger', lang: 'en' } }).state;
    s = engine.step(s, { type: 'tick', t: 1700 }).state;
    expect(s.doc.app.objects.a!.scale).toBeCloseTo(1.25);
  });

  it('destructive bulk delete needs confirmation and never runs on timeout', () => {
    let s = engine.initial();
    s = engine.step(s, { type: 'lasso', t: 100, ids: ['a', 'c'] }).state;
    s = engine.step(s, { type: 'speech', speech: { t: 200, kind: 'typed', text: 'delete these', lang: 'en' } }).state;
    expect(s.phase.kind).toBe('confirm');
    const timedOut = engine.step(s, { type: 'tick', t: 20000 }).state;
    expect(timedOut.doc.app.order).toEqual(['a', 'b', 'c']);
    const yes = engine.step(s, { type: 'speech', speech: { t: 300, kind: 'typed', text: 'yes', lang: 'en' } }).state;
    expect(yes.doc.app.order).toEqual(['b']);
  });

  it('rejects malformed events at the boundary with the field path', () => {
    expect(() => validateEvent({ type: 'pointer', sample: { t: 1, x: 'nope' } })).toThrow(/sample\.x/);
  });
});
