import type { CandidateEvidence, FusionConfig, Millis, PointerSample, Selectable } from './types.ts';

/**
 * Time weight relative to the word time (d = t_sample - tWord, ms).
 * People point first, then speak, so the plateau sits before the word:
 *   [-before, -before+150]  ramps 0.5 -> 1
 *   [-before+150, -50]      plateau 1
 *   [-50, +after]           falls 1 -> 0.3
 *   outside                 0
 * `flat` mode (typed commands) weights every sample in the window 1.
 */
export function timeWeight(d: Millis, cfg: Pick<FusionConfig, 'windowBefore' | 'windowAfter'>, flat = false): number {
  const before = cfg.windowBefore;
  const after = cfg.windowAfter;
  if (d < -before || d > after) return 0;
  if (flat) return 1;
  const rampEnd = -before + 150;
  if (d < rampEnd) return 0.5 + (0.5 * (d + before)) / 150;
  if (d <= -50) return 1;
  return 1 - (0.7 * (d + 50)) / (after + 50);
}

/** Stability falls as pointer speed rises: 1 / (1 + (v / v0)^2). */
export function stability(speedPxPerMs: number, v0: number): number {
  const r = speedPxPerMs / v0;
  return 1 / (1 + r * r);
}

export interface PreparedSample {
  s: PointerSample;
  dt: Millis;
  speed: number;
  stab: number;
}

/** Attach dt, speed and stability to each sample from its predecessor in the full buffer. */
export function prepareSamples(samples: readonly PointerSample[], cfg: FusionConfig): PreparedSample[] {
  const out: PreparedSample[] = [];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    const p = samples[i - 1];
    const gap = p ? s.t - p.t : 33;
    const dt = Math.min(Math.max(gap, 0), cfg.maxDt);
    const speed = p && gap > 0 ? Math.hypot(s.x - p.x, s.y - p.y) / gap : 0;
    out.push({ s, dt, speed, stab: stability(speed, cfg.stabilitySpeed) });
  }
  return out;
}

export interface ScoreOptions {
  tWord: Millis;
  window: [Millis, Millis];
  flat: boolean;
  candidates: readonly Selectable[];
}

/** Evidence per candidate (fusion-engine requirement 2.2). Sorted best first, ties by id. */
export function scoreCandidates(prepared: readonly PreparedSample[], cfg: FusionConfig, o: ScoreOptions): CandidateEvidence[] {
  const allowed = new Map(o.candidates.map((c) => [c.id, c]));
  const acc = new Map<string, { e: number; time: number; conf: number; q: number; st: number; w: number; n: number }>();
  for (const p of prepared) {
    const { s } = p;
    if (s.t < o.window[0] || s.t > o.window[1]) continue;
    if (s.pose !== 'point') continue;
    const tw = timeWeight(s.t - o.tWord, cfg, o.flat);
    if (tw <= 0) continue;
    for (const h of s.hits) {
      if (h.quality <= 0 || !allowed.has(h.id)) continue;
      const base = tw * (p.dt / 1000);
      const e = base * s.conf * h.quality * p.stab;
      const a = acc.get(h.id) ?? { e: 0, time: 0, conf: 0, q: 0, st: 0, w: 0, n: 0 };
      a.e += e;
      a.time += base;
      a.conf += s.conf * base;
      a.q += h.quality * base;
      a.st += p.stab * base;
      a.w += base;
      a.n += 1;
      acc.set(h.id, a);
    }
  }
  const out: CandidateEvidence[] = [];
  for (const [id, a] of acc) {
    const c = allowed.get(id)!;
    const w = a.w || 1;
    out.push({
      id,
      label: c.label,
      evidence: a.e,
      parts: { time: a.time, conf: a.conf / w, quality: a.q / w, stability: a.st / w },
      samples: a.n,
    });
  }
  return out.sort((a, b) => b.evidence - a.evidence || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Decide between best and runner-up with the margin rule. */
export function decide(
  ranked: readonly CandidateEvidence[],
  cfg: Pick<FusionConfig, 'minEvidence' | 'margin'>,
): { kind: 'none' } | { kind: 'ask'; options: CandidateEvidence[] } | { kind: 'bind'; best: CandidateEvidence; confidence: number } {
  const best = ranked[0];
  if (!best || best.evidence < cfg.minEvidence) return { kind: 'none' };
  const second = ranked[1];
  if (second && (best.evidence - second.evidence) / best.evidence < cfg.margin) {
    const floor = best.evidence * (1 - cfg.margin);
    const options = ranked.filter((c) => c.evidence >= floor).slice(0, 4);
    return { kind: 'ask', options: options.length >= 2 ? options : ranked.slice(0, 2) };
  }
  const total = ranked.reduce((a, c) => a + c.evidence, 0);
  return { kind: 'bind', best, confidence: total > 0 ? best.evidence / total : 1 };
}

/** Distinct dwell segments (top hit per sample), chronological. Used for typed multi-deictic commands. */
export function dwellSegments(
  prepared: readonly PreparedSample[],
  window: [Millis, Millis],
  allowed: ReadonlySet<string>,
): Array<{ id: string; start: Millis; end: Millis; score: number }> {
  const segs: Array<{ id: string; start: Millis; end: Millis; score: number }> = [];
  for (const p of prepared) {
    const { s } = p;
    if (s.t < window[0] || s.t > window[1] || s.pose !== 'point') continue;
    let top: { id: string; quality: number } | null = null;
    for (const h of s.hits) if (allowed.has(h.id) && h.quality > 0 && (!top || h.quality > top.quality)) top = h;
    if (!top) continue;
    const last = segs[segs.length - 1];
    const add = (p.dt / 1000) * s.conf * top.quality * p.stab;
    if (last && last.id === top.id) {
      last.end = s.t;
      last.score += add;
    } else segs.push({ id: top.id, start: s.t, end: s.t, score: add });
  }
  return segs;
}
