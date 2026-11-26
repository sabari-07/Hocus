import { describe, expect, it } from 'vitest';
import { detectHeadGesture, type NoseSample } from '../../packages/vision/src/pose.ts';

/** A nose path sampled at 30 Hz: centre (0.5, 0.5) plus a sinusoid on one axis and noise on the other. */
function path(axis: 'x' | 'y', amp: number, periodMs: number, ms: number, cross = 0, drift = 0): NoseSample[] {
  const out: NoseSample[] = [];
  for (let t = 0, i = 0; t <= ms; t += 33, i++) {
    const s = Math.sin((2 * Math.PI * t) / periodMs) * amp;
    const o = (i % 2 ? 1 : -1) * cross;
    out.push({ t, x: 0.5 + drift * (t / 1000) + (axis === 'x' ? s : o), y: 0.5 + (axis === 'y' ? s : o) });
  }
  return out;
}

describe('head gestures (pointer-input 5: nod confirms, shake cancels)', () => {
  it('a nod is a vertical oscillation', () => expect(detectHeadGesture(path('y', 0.03, 600, 1200))).toBe('nod'));
  it('a shake is a horizontal oscillation', () => expect(detectHeadGesture(path('x', 0.03, 600, 1200))).toBe('shake'));
  it('a still head and tiny tremor do nothing', () => {
    expect(detectHeadGesture(path('y', 0.002, 400, 1200))).toBeNull();
    expect(detectHeadGesture(path('x', 0, 400, 1200, 0.003))).toBeNull();
  });
  it('slow head pointing across the screen never fires (no reversals)', () => {
    expect(detectHeadGesture(path('x', 0, 600, 1300, 0, 0.3))).toBeNull();
  });
  it('a diagonal wobble is ambiguous and does nothing', () => {
    const p = path('y', 0.03, 600, 1200).map((s) => ({ ...s, x: 0.5 + (s.y - 0.5) }));
    expect(detectHeadGesture(p)).toBeNull();
  });
  it('too few samples or an empty path do nothing', () => {
    expect(detectHeadGesture([])).toBeNull();
    expect(detectHeadGesture(path('y', 0.03, 600, 150))).toBeNull();
  });
});
