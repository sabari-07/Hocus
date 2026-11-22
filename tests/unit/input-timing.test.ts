import { describe, expect, it } from 'vitest';
import { createEngine, estimateWordTimes, newTrack, replay, trackInterim } from '@hocus/core';
import { applyHomography, solveHomography, touchpadMap } from '../../packages/input/src/mapping.ts';
import { aperture, classifyPose, type Lm } from '../../packages/vision/src/pose.ts';
import { EMPTY_SPOT, centerOf, makeTestApp, mergeEvents, pointerEvents, samplesFromPath, utteranceEvents, waypointPath, type SimObject } from '@hocus/testkit';

/** A synthetic right hand: wrist at origin, fingers along -y. `ext` = which fingers are extended (thumb..pinky). */
function hand(ext: [boolean, boolean, boolean, boolean, boolean], spread = 0.1): Lm[] {
  const lm: Lm[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  const bases = [-0.08, -0.03, 0, 0.03, 0.06];
  for (let f = 0; f < 5; f++) {
    for (let j = 1; j <= 4; j++) {
      const idx = 1 + f * 4 + (j - 1);
      const reach = ext[f] ? j * 0.06 : j <= 2 ? j * 0.05 : 0.1 - (j - 2) * 0.03;
      lm[idx] = { x: bases[f]! + (f === 0 ? -spread * (j / 4) : 0), y: -reach, z: 0 };
    }
  }
  return lm;
}

describe('pose classification (pointer-input 4)', () => {
  it('index extended, others curled -> point', () => expect(classifyPose(hand([false, true, false, false, false]))).toBe('point'));
  it('fist -> rest', () => expect(classifyPose(hand([false, false, false, false, false]))).toBe('rest'));
  it('built-in gestures win: thumbs-up confirms, open palm cancels', () => {
    expect(classifyPose(hand([true, true, true, true, true]), 'Thumb_Up')).toBe('confirm');
    expect(classifyPose(hand([true, true, true, true, true]), 'Open_Palm')).toBe('cancel');
  });
  it('aperture is clamped to 0..1 and grows with thumb-index spread', () => {
    const a = aperture(hand([true, true, false, false, false], 0.02))!;
    const b = aperture(hand([true, true, false, false, false], 0.4))!;
    expect(a).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThanOrEqual(1);
    expect(b).toBeGreaterThan(a);
  });
});

describe('screen mapping (pointer-input 3)', () => {
  it('virtual touchpad maps the mirrored middle 60% to the full screen', () => {
    expect(touchpadMap(0.8, 0.2, 1000, 500)).toEqual({ x: 0, y: 0 });
    expect(touchpadMap(0.2, 0.8, 1000, 500)).toEqual({ x: 1000, y: 500 });
    expect(touchpadMap(0.5, 0.5, 1000, 500)).toEqual({ x: 500, y: 250 });
  });
  it('four-corner homography maps calibration points exactly', () => {
    const src = [{ x: 0.3, y: 0.25 }, { x: 0.72, y: 0.22 }, { x: 0.75, y: 0.78 }, { x: 0.27, y: 0.8 }];
    const dst = [{ x: 0, y: 0 }, { x: 1280, y: 0 }, { x: 1280, y: 720 }, { x: 0, y: 720 }];
    const H = solveHomography(src, dst)!;
    src.forEach((p, i) => {
      const q = applyHomography(H, p);
      expect(q.x).toBeCloseTo(dst[i]!.x, 3);
      expect(q.y).toBeCloseTo(dst[i]!.y, 3);
    });
  });
});

describe('word timing (speech-input, fusion-engine 6)', () => {
  it('interim first-seen minus lag, and earlier times are never moved', () => {
    let tr = newTrack('en', 1000);
    tr = trackInterim(tr, 'make that', 1600, 1);
    tr = trackInterim(tr, 'make that bigger', 1900, 1);
    const w = estimateWordTimes({ track: tr, finalT: 2200, tokenIndices: [1], tokenCount: 3, lagMs: 350 });
    expect(w.times).toEqual([1250]);
    expect(w.method).toEqual(['interim']);
  });
  it('falls back to token position, and averages with VAD when present', () => {
    const pos = estimateWordTimes({ track: newTrack('en', 1000), finalT: 2350, tokenIndices: [0, 2], tokenCount: 4, lagMs: 350 });
    expect(pos.method).toEqual(['position', 'position']);
    expect(pos.times[0]!).toBeLessThan(pos.times[1]!);
    const vad = estimateWordTimes({ track: newTrack('en', 1000), finalT: 2350, tokenIndices: [1], tokenCount: 2, lagMs: 350, vad: [{ start: 1200, end: 1800 }] });
    expect(vad.method).toEqual(['vad']);
    expect(vad.times[0]).toBeCloseTo(1650, 0);
  });
});

const objects: SimObject[] = [
  { id: 'a', label: 'Pumpkin', kind: 'block', caps: ['scalable', 'colorable'], rect: { x: 100, y: 100, w: 80, h: 80 } },
  { id: 'b', label: 'Ghost', kind: 'block', caps: ['scalable', 'colorable'], rect: { x: 500, y: 100, w: 80, h: 80 } },
];
const engine = createEngine(makeTestApp(objects));

describe('dialogue repairs (dialogue-manager 4)', () => {
  it('"not that" undoes and resolves again without the first choice', () => {
    const path = waypointPath(1000, [{ ...centerOf(objects[1]!), hold: 300 }, { ...centerOf(objects[0]!), hold: 900, move: 100 }, { ...EMPTY_SPOT, hold: 1200, move: 100 }]);
    let { state } = replay(engine, mergeEvents(pointerEvents(samplesFromPath(path, objects)), utteranceEvents('make that bigger', 1500, [2150], 2400), [{ type: 'tick', t: 3100 }]));
    expect(state.doc.app.objects.a!.scale).toBeCloseTo(1.25);
    state = engine.step(state, { type: 'speech', speech: { t: 3700, kind: 'typed', text: 'not that', lang: 'en' } }).state;
    state = engine.step(state, { type: 'tick', t: 6000 }).state;
    expect(state.doc.app.objects.a!.scale).toBe(1);
    expect(state.doc.app.objects.b!.scale).toBeCloseTo(1.25);
  });

  it('"what was that?" names the last dwelled object', () => {
    const path = waypointPath(1000, [{ ...centerOf(objects[1]!), hold: 600 }, { ...EMPTY_SPOT, hold: 300, move: 100 }]);
    let { state } = replay(engine, pointerEvents(samplesFromPath(path, objects)));
    const r = engine.step(state, { type: 'speech', speech: { t: 2200, kind: 'typed', text: 'what was that', lang: 'en' } });
    state = r.state;
    expect(r.effects.some((e) => e.type === 'announce' && /Ghost/.test(e.text))).toBe(true);
  });

  it('pointAction: "that one" outside a question runs the app pointing action', async () => {
    const { planetApp } = await import('../../apps/planet-explorer/src/app.ts');
    const pe = createEngine(planetApp);
    let s = pe.initial();
    s = pe.step(s, { type: 'command', t: 10, action: 'quiz', args: { on: true } }).state;
    s = pe.step(s, { type: 'select', t: 20, ids: ['venus'], mode: 'replace' }).state;
    s = pe.step(s, { type: 'speech', speech: { t: 30, kind: 'typed', text: 'that one', lang: 'en' } }).state;
    s = pe.step(s, { type: 'tick', t: 1000 }).state;
    expect(s.doc.app.quiz).toMatchObject({ score: 1, asked: 1, last: 'right' });
  });
});
