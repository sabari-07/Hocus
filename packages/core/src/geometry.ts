import type { SpatialRelation, Vec3 } from './types.ts';

export interface Point2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Ray-casting point-in-polygon test. */
export function pointInPolygon(p: Point2, poly: readonly Point2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Fraction of a rect's area inside a polygon, estimated on a deterministic n×n grid. */
export function rectFractionInPolygon(r: Rect, poly: readonly Point2[], n = 7): number {
  if (poly.length < 3 || r.w <= 0 || r.h <= 0) return 0;
  let inside = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const p = { x: r.x + ((i + 0.5) / n) * r.w, y: r.y + ((j + 0.5) / n) * r.h };
      if (pointInPolygon(p, poly)) inside++;
    }
  return inside / (n * n);
}

/** Objects whose projected area is at least `threshold` inside the lasso loop (requirement 3.5). */
export function selectInLoop(
  loop: readonly Point2[],
  rects: ReadonlyArray<{ id: string; rect: Rect }>,
  threshold = 0.6,
): string[] {
  return rects.filter((o) => rectFractionInPolygon(o.rect, loop) >= threshold).map((o) => o.id);
}

/**
 * Detect a closed loop at the end of a pointer path: the latest point returns within `closeDist`
 * of a point at least `minAgeMs` older, and the path between is long enough. Returns the loop or null.
 */
export function detectLoop(
  path: ReadonlyArray<Point2 & { t: number }>,
  closeDist = 40,
  minAgeMs = 400,
  minPerimeter = 220,
): Point2[] | null {
  const n = path.length;
  if (n < 8) return null;
  const last = path[n - 1]!;
  for (let i = n - 8; i >= 0; i--) {
    const p = path[i]!;
    if (last.t - p.t < minAgeMs) continue;
    if (Math.hypot(last.x - p.x, last.y - p.y) <= closeDist) {
      let per = 0;
      for (let k = i + 1; k < n; k++) per += Math.hypot(path[k]!.x - path[k - 1]!.x, path[k]!.y - path[k - 1]!.y);
      if (per >= minPerimeter) return path.slice(i).map(({ x, y }) => ({ x, y }));
    }
  }
  return null;
}

/** World-space place for spatial words. Camera is assumed to look down -z, so +x is screen-right. */
export function spatialPlace(rel: SpatialRelation, refs: ReadonlyArray<{ pos: Vec3; size: number }>): Vec3 | null {
  const a = refs[0];
  if (!a) return null;
  const gap = a.size * 1.2 + 0.2;
  switch (rel) {
    case 'leftOf':
      return { x: a.pos.x - gap, y: a.pos.y, z: a.pos.z };
    case 'rightOf':
    case 'nextTo':
      return { x: a.pos.x + gap, y: a.pos.y, z: a.pos.z };
    case 'onTopOf':
      return { x: a.pos.x, y: a.pos.y + a.size, z: a.pos.z };
    case 'inFrontOf':
      return { x: a.pos.x, y: a.pos.y, z: a.pos.z + gap };
    case 'behind':
      return { x: a.pos.x, y: a.pos.y, z: a.pos.z - gap };
    case 'between': {
      const b = refs[1];
      if (!b) return null;
      return { x: (a.pos.x + b.pos.x) / 2, y: (a.pos.y + b.pos.y) / 2, z: (a.pos.z + b.pos.z) / 2 };
    }
  }
}
