/**
 * One Euro filter (Casiez, Roussel, Vogel, CHI 2012): steady when slow, responsive when fast.
 * Pure: the caller passes timestamps. Lives in core so it can be property-tested (P9).
 */
export interface OneEuroParams {
  minCutoff: number; // Hz
  beta: number;
  dCutoff: number; // Hz
}

export const DEFAULT_ONE_EURO: OneEuroParams = { minCutoff: 1.2, beta: 0.012, dCutoff: 1.0 };

export interface OneEuroState {
  x: number;
  dx: number;
  t: number;
  initialized: boolean;
}

const alpha = (cutoff: number, dtSec: number) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dtSec);
};

export function oneEuroInit(): OneEuroState {
  return { x: 0, dx: 0, t: 0, initialized: false };
}

/** Returns [filteredValue, nextState]. `t` in ms. */
export function oneEuroStep(
  state: OneEuroState,
  value: number,
  t: number,
  p: OneEuroParams = DEFAULT_ONE_EURO,
): [number, OneEuroState] {
  if (!state.initialized) return [value, { x: value, dx: 0, t, initialized: true }];
  const dtSec = Math.max((t - state.t) / 1000, 1e-3);
  const rawDx = (value - state.x) / dtSec;
  const aD = alpha(p.dCutoff, dtSec);
  const dx = aD * rawDx + (1 - aD) * state.dx;
  const cutoff = p.minCutoff + p.beta * Math.abs(dx);
  const a = alpha(cutoff, dtSec);
  const x = a * value + (1 - a) * state.x;
  return [x, { x, dx, t, initialized: true }];
}

/** 2D convenience wrapper. */
export class OneEuro2D {
  private sx = oneEuroInit();
  private sy = oneEuroInit();
  constructor(private params: OneEuroParams = DEFAULT_ONE_EURO) {}
  setParams(p: Partial<OneEuroParams>) {
    this.params = { ...this.params, ...p };
  }
  reset() {
    this.sx = oneEuroInit();
    this.sy = oneEuroInit();
  }
  filter(x: number, y: number, t: number): [number, number] {
    const [fx, nx] = oneEuroStep(this.sx, x, t, this.params);
    const [fy, ny] = oneEuroStep(this.sy, y, t, this.params);
    this.sx = nx;
    this.sy = ny;
    return [fx, fy];
  }
}
