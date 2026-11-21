import type { LangCode, Millis } from './types.ts';

/**
 * Word-time estimation (fusion-engine requirement 6).
 *
 * Browsers give text but no per-word times. We note the moment an interim transcript first
 * contains the k-th timed word (deictic or anaphor) and subtract the calibrated recognizer lag.
 * Words never seen in interims are placed by relative token position between speech start and
 * the final event. Voice-activity segments, when present, refine the estimate.
 */
export interface UtteranceTrack {
  startT: Millis | null;
  lang: LangCode;
  /** Raw interim time at which the k-th timed word was first seen (before lag). */
  firstSeen: Array<Millis | null>;
  lastInterim: string;
}

export function newTrack(lang: LangCode, startT: Millis | null): UtteranceTrack {
  return { startT, lang, firstSeen: [], lastInterim: '' };
}

/** Record first-seen times for timed words in an interim transcript. Never moves an earlier time. */
export function trackInterim(track: UtteranceTrack, text: string, t: Millis, timedCount: number): UtteranceTrack {
  const firstSeen = [...track.firstSeen];
  for (let k = 0; k < timedCount; k++) if (firstSeen[k] == null) firstSeen[k] = t;
  return { ...track, firstSeen, lastInterim: text };
}

export interface WordTimeInput {
  track: UtteranceTrack | null;
  finalT: Millis;
  /** Token index of each timed word, in order. */
  tokenIndices: number[];
  tokenCount: number;
  lagMs: Millis;
  vad?: ReadonlyArray<{ start: Millis; end: Millis }>;
}

export interface WordTimes {
  times: Millis[];
  /** Raw first-seen interim times (null if never seen) - kept for self-calibration. */
  seen: Array<Millis | null>;
  method: Array<'interim' | 'position' | 'vad' | 'interim+vad'>;
}

function vadTimeAt(vad: ReadonlyArray<{ start: Millis; end: Millis }>, lo: Millis, hi: Millis, p: number): Millis | null {
  const segs = vad
    .map((s) => ({ start: Math.max(lo, s.start), end: Math.min(hi, s.end) }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);
  const total = segs.reduce((a, s) => a + (s.end - s.start), 0);
  if (total <= 0) return null;
  let target = p * total;
  for (const s of segs) {
    const d = s.end - s.start;
    if (target <= d) return s.start + target;
    target -= d;
  }
  return segs[segs.length - 1]!.end;
}

export function estimateWordTimes(input: WordTimeInput): WordTimes {
  const { track, finalT, tokenIndices, tokenCount, lagMs, vad } = input;
  const start = track?.startT ?? finalT - 2000;
  const end = Math.max(start, finalT - lagMs);
  const times: Millis[] = [];
  const seen: Array<Millis | null> = [];
  const method: WordTimes['method'] = [];
  tokenIndices.forEach((tokenIndex, k) => {
    const s = track?.firstSeen[k] ?? null;
    seen.push(s);
    const p = tokenCount > 0 ? (tokenIndex + 0.5) / tokenCount : 0.5;
    const interimEst = s != null ? Math.max(start, s - lagMs) : null;
    const vadEst = vad && vad.length ? vadTimeAt(vad, start, finalT, p) : null;
    let t: Millis;
    if (interimEst != null && vadEst != null) {
      t = (interimEst + vadEst) / 2;
      method.push('interim+vad');
    } else if (interimEst != null) {
      t = interimEst;
      method.push('interim');
    } else if (vadEst != null) {
      t = vadEst;
      method.push('vad');
    } else {
      t = start + (end - start) * p;
      method.push('position');
    }
    times.push(Math.min(finalT, t));
  });
  return { times, seen, method };
}
