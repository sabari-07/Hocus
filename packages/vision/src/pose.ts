import type { PointerPose } from '@hocus/core';

export interface Lm {
  x: number;
  y: number;
  z: number;
}

const d = (a: Lm, b: Lm) => Math.hypot(a.x - b.x, a.y - b.y, (a.z - b.z) * 0.5);

/**
 * Classify a hand pose from 21 MediaPipe landmarks plus the built-in gesture label.
 * - point: index extended, middle/ring/pinky curled (or the built-in Pointing_Up)
 * - confirm: Thumb_Up; cancel: Open_Palm; rest: fist or anything else
 * Pure geometry, unit-tested in tests/unit/vision-pose.test.ts.
 */
export function classifyPose(lm: readonly Lm[], gesture?: string): PointerPose {
  if (gesture === 'Thumb_Up') return 'confirm';
  if (gesture === 'Open_Palm') return 'cancel';
  if (gesture === 'Pointing_Up') return 'point';
  if (lm.length < 21) return 'rest';
  const wrist = lm[0]!;
  const extended = (tip: number, pip: number) => d(lm[tip]!, wrist) > d(lm[pip]!, wrist) * 1.15;
  const index = extended(8, 6);
  const middle = extended(12, 10);
  const ring = extended(16, 14);
  const pinky = extended(20, 18);
  if (index && !ring && !pinky) return 'point'; // middle may be half-curled for many people
  if (index && middle && !ring && !pinky) return 'point';
  return 'rest';
}

/** Thumb-to-index spread relative to hand size, mapped to 0..1 ("make it this big"). */
export function aperture(lm: readonly Lm[]): number | undefined {
  if (lm.length < 21) return undefined;
  const size = d(lm[0]!, lm[9]!);
  if (size <= 1e-6) return undefined;
  const spread = d(lm[4]!, lm[8]!) / size;
  return Math.min(1, Math.max(0, (spread - 0.15) / 1.35));
}

export interface NoseSample {
  t: number;
  /** Camera-normalized, 0..1. */
  x: number;
  y: number;
}

/**
 * Detect a head nod (up-down) or shake (left-right) in the recent nose path (hands-free confirm / cancel).
 * A gesture is at least three alternating swings of >= `minSwing` on one axis inside `windowMs`, while the other
 * axis moves less than `crossRatio` of that. A slow drift (head pointing) has no reversals, so it never fires.
 * Pure: the caller supplies timestamps.
 */
export function detectHeadGesture(
  path: readonly NoseSample[],
  opts: { windowMs?: number; minSwing?: number; crossRatio?: number; minSwings?: number } = {},
): 'nod' | 'shake' | null {
  const { windowMs = 1300, minSwing = 0.016, crossRatio = 0.65, minSwings = 3 } = opts;
  const last = path[path.length - 1];
  if (!last) return null;
  const recent = path.filter((p) => last.t - p.t <= windowMs);
  if (recent.length < 8) return null;
  const swings = (axis: 'x' | 'y') => {
    let dir = 0;
    let anchor = recent[0]![axis];
    let count = 0;
    let lo = anchor;
    let hi = anchor;
    for (const p of recent) {
      const v = p[axis];
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
      const d = v - anchor;
      if (Math.abs(d) >= minSwing) {
        const nd = Math.sign(d);
        if (nd !== dir) count += 1;
        dir = nd;
        anchor = v;
      }
    }
    return { count, span: hi - lo };
  };
  const x = swings('x');
  const y = swings('y');
  if (y.count >= minSwings && x.span < y.span * crossRatio) return 'nod';
  if (x.count >= minSwings && y.span < x.span * crossRatio) return 'shake';
  return null;
}

/** Pointer anchor: the index fingertip. */
export function pointerAnchor(lm: readonly Lm[]): { x: number; y: number } | null {
  const tip = lm[8];
  return tip ? { x: tip.x, y: tip.y } : null;
}
