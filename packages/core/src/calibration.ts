import { prepareSamples, scoreCandidates } from './evidence.ts';
import type { FusionConfig, Millis, PointerSample, Selectable } from './types.ts';

/**
 * Self-calibration (fusion-engine requirement 6.5-6.6).
 * After "no, the other one", find the lag that would have made the chosen candidate win and move
 * the current estimate `calibrationRate` of the way toward it. Always clamped to [lagMin, lagMax].
 */
export function calibrateLag(input: {
  samples: readonly PointerSample[];
  candidates: readonly Selectable[];
  seen: Millis;
  chosenId: string;
  cfg: FusionConfig;
}): { lagMs: number; target: number } | null {
  const { cfg } = input;
  const prepared = prepareSamples(input.samples, cfg);
  let target: number | null = null;
  for (let L = cfg.lagMin; L <= cfg.lagMax; L += 25) {
    const tWord = input.seen - L;
    const ranked = scoreCandidates(prepared, cfg, {
      tWord,
      window: [tWord - cfg.windowBefore, tWord + cfg.windowAfter],
      flat: false,
      candidates: input.candidates,
    });
    if (ranked[0]?.id === input.chosenId && ranked[0].evidence >= cfg.minEvidence) {
      if (target === null || Math.abs(L - cfg.lagMs) < Math.abs(target - cfg.lagMs)) target = L;
    }
  }
  if (target === null) return null;
  return { lagMs: nudgeLag(cfg.lagMs, target, cfg), target };
}

export function nudgeLag(current: number, target: number, cfg: Pick<FusionConfig, 'calibrationRate' | 'lagMin' | 'lagMax'>): number {
  const next = current + cfg.calibrationRate * (target - current);
  return Math.min(cfg.lagMax, Math.max(cfg.lagMin, next));
}
