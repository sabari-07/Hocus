/**
 * Camera-normalized (0..1) coordinates -> screen coordinates.
 * Default: a "virtual touchpad", the middle `pad` fraction of the camera frame, mirrored and
 * stretched to the screen. Optional four-corner calibration replaces it with a homography.
 */
export interface Pt {
  x: number;
  y: number;
}

export function touchpadMap(nx: number, ny: number, w: number, h: number, pad = 0.6, mirror = true): Pt {
  const mx = mirror ? 1 - nx : nx;
  const lo = (1 - pad) / 2;
  const u = Math.min(1, Math.max(0, (mx - lo) / pad));
  const v = Math.min(1, Math.max(0, (ny - lo) / pad));
  return { x: u * w, y: v * h };
}

/** Solve the 3x3 homography mapping 4 source points to 4 destination points (DLT, Gaussian elimination). */
export function solveHomography(src: readonly Pt[], dst: readonly Pt[]): number[] | null {
  if (src.length !== 4 || dst.length !== 4) return null;
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i]!;
    const { x: u, y: v } = dst[i]!;
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const n = 8;
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r]![c]!) > Math.abs(A[piv]![c]!)) piv = r;
    if (Math.abs(A[piv]![c]!) < 1e-12) return null;
    [A[c], A[piv]] = [A[piv]!, A[c]!];
    [b[c], b[piv]] = [b[piv]!, b[c]!];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r]![c]! / A[c]![c]!;
      for (let k = c; k < n; k++) A[r]![k]! -= f * A[c]![k]!;
      b[r]! -= f * b[c]!;
    }
  }
  const h = b.map((v, i) => v / A[i]![i]!);
  return [...h, 1];
}

export function applyHomography(H: readonly number[], p: Pt): Pt {
  const w = H[6]! * p.x + H[7]! * p.y + H[8]!;
  return { x: (H[0]! * p.x + H[1]! * p.y + H[2]!) / w, y: (H[3]! * p.x + H[4]! * p.y + H[5]!) / w };
}
