import type { FusionConfig } from './types.ts';

/**
 * Default fusion parameters. Documented in .kiro/specs/fusion-engine/design.md (section "Parameters").
 * Change them there and here together.
 */
export const DEFAULT_CONFIG: FusionConfig = {
  windowBefore: 800,
  windowAfter: 300,
  minEvidence: 0.08,
  margin: 0.15,
  stabilitySpeed: 0.6,
  maxDt: 100,
  lagMs: 350,
  typedLookback: 1500,
  previewMs: 600,
  askTimeoutMs: 8000,
  confirmTimeoutMs: 8000,
  lassoFreshMs: 4000,
  itOverrideEvidence: 0.2,
  calibrationRate: 0.3,
  lagMin: 100,
  lagMax: 1200,
  bufferMs: 4000,
  requireWakeWord: false,
  wakeWord: 'hocus',
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Apply a config patch with sane bounds so live tuning can never break the engine. */
export function patchConfig(base: FusionConfig, patch: Partial<FusionConfig>): FusionConfig {
  const c = { ...base, ...patch };
  c.windowBefore = clamp(c.windowBefore, 200, 3000);
  c.windowAfter = clamp(c.windowAfter, 0, 1500);
  c.minEvidence = clamp(c.minEvidence, 0.005, 2);
  c.margin = clamp(c.margin, 0, 0.9);
  c.stabilitySpeed = clamp(c.stabilitySpeed, 0.05, 10);
  c.maxDt = clamp(c.maxDt, 10, 500);
  c.lagMin = clamp(c.lagMin, 0, 1000);
  c.lagMax = clamp(c.lagMax, c.lagMin, 3000);
  c.lagMs = clamp(c.lagMs, c.lagMin, c.lagMax);
  c.previewMs = clamp(c.previewMs, 0, 5000);
  c.bufferMs = clamp(c.bufferMs, Math.max(2000, c.windowBefore + c.windowAfter + 500), 20000);
  c.calibrationRate = clamp(c.calibrationRate, 0, 1);
  return c;
}
