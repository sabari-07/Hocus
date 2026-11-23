import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  calibrateLag,
  decide,
  dwellSegments,
  estimateWordTimes,
  newTrack,
  prepareSamples,
  scoreCandidates,
  stability,
  timeWeight,
  trackInterim,
  type CandidateEvidence,
  type PointerSample,
  type Selectable,
} from '@hocus/core';

const cfg = DEFAULT_CONFIG;
const S = (t: number, id: string | null, o: Partial<PointerSample> = {}): PointerSample => ({
  t,
  x: o.x ?? 100,
  y: 100,
  conf: o.conf ?? 1,
  source: 'mouse',
  pose: o.pose ?? 'point',
  hits: id ? [{ id, quality: (o as { q?: number }).q ?? 1 }] : [],
});
const SEL = (id: string): Selectable => ({ id, label: id.toUpperCase(), kind: 'k', caps: [] });

describe('timeWeight shape (fusion-engine design: time weight)', () => {
  it.each([
    [-801, 0],
    [-800, 0.5],
    [-725, 0.75],
    [-650, 1],
    [-300, 1],
    [-50, 1],
    [125, 0.65],
    [300, 0.3],
    [301, 0],
  ])('d=%i -> %f', (d, w) => expect(timeWeight(d, cfg)).toBeCloseTo(w, 6));
  it('flat mode is 1 inside the window and 0 outside', () => {
    expect(timeWeight(-800, cfg, true)).toBe(1);
    expect(timeWeight(0, cfg, true)).toBe(1);
    expect(timeWeight(301, cfg, true)).toBe(0);
    expect(timeWeight(-801, cfg, true)).toBe(0);
  });
});

describe('stability and sample preparation', () => {
  it('stability(0)=1, stability(v0)=0.5, stability(2v0)=0.2', () => {
    expect(stability(0, 0.6)).toBe(1);
    expect(stability(0.6, 0.6)).toBeCloseTo(0.5, 9);
    expect(stability(1.2, 0.6)).toBeCloseTo(0.2, 9);
  });
  it('dt is capped at maxDt, the first sample gets 33 ms, speed is px/ms', () => {
    const p = prepareSamples([S(0, null, { x: 0 }), S(50, null, { x: 30 }), S(1000, null, { x: 30 })], cfg);
    expect(p.map((x) => x.dt)).toEqual([33, 50, 100]);
    expect(p[0]!.speed).toBe(0);
    expect(p[1]!.speed).toBeCloseTo(0.6, 9);
    expect(p[1]!.stab).toBeCloseTo(0.5, 9);
    expect(p[2]!.speed).toBe(0);
  });
});

describe('scoreCandidates', () => {
  const sels = [SEL('a'), SEL('b')];
  it('integrates weight · conf · quality · stability · dt exactly', () => {
    // three still samples on "a" 100 ms apart, all in the plateau; conf 0.5 halves the evidence.
    const samples = [S(0, 'a', { conf: 0.5 }), S(100, 'a', { conf: 0.5 }), S(200, 'a', { conf: 0.5 })];
    const r = scoreCandidates(prepareSamples(samples, cfg), cfg, { tWord: 400, window: [-400, 700], flat: false, candidates: sels });
    expect(r).toHaveLength(1);
    expect(r[0]!.id).toBe('a');
    expect(r[0]!.evidence).toBeCloseTo((0.033 + 0.1 + 0.1) * 0.5, 9);
    expect(r[0]!.parts.time).toBeCloseTo(0.233, 9);
    expect(r[0]!.parts.conf).toBeCloseTo(0.5, 9);
    expect(r[0]!.parts.quality).toBeCloseTo(1, 9);
    expect(r[0]!.parts.stability).toBeCloseTo(1, 9);
    expect(r[0]!.samples).toBe(3);
  });
  it('ignores rest poses, samples outside the window and ids that are not candidates', () => {
    const samples = [S(0, 'a', { pose: 'rest' }), S(100, 'c'), S(5000, 'b'), S(200, 'b')];
    const r = scoreCandidates(prepareSamples(samples, cfg), cfg, { tWord: 400, window: [-400, 700], flat: false, candidates: sels });
    expect(r.map((c) => c.id)).toEqual(['b']);
  });
  it('sorts by evidence, ties by id', () => {
    const samples = [S(0, 'b'), S(100, 'a')];
    const prepared = prepareSamples(samples, cfg).map((p) => ({ ...p, dt: 50 }));
    const r = scoreCandidates(prepared, cfg, { tWord: 400, window: [-400, 700], flat: false, candidates: sels });
    expect(r.map((c) => c.id)).toEqual(['a', 'b']);
  });
});

describe('decide', () => {
  const C = (id: string, evidence: number): CandidateEvidence => ({ id, label: id, evidence, parts: { time: 0, conf: 1, quality: 1, stability: 1 }, samples: 1 });
  it('none below minEvidence', () => expect(decide([C('a', 0.079)], cfg)).toEqual({ kind: 'none' }));
  it('binds at exactly minEvidence with no runner-up, confidence 1', () => expect(decide([C('a', 0.08)], cfg)).toMatchObject({ kind: 'bind', confidence: 1 }));
  it('asks when the runner-up is within the margin and offers every close option', () => {
    const d = decide([C('a', 1), C('b', 0.9), C('c', 0.86), C('d', 0.5)], cfg);
    expect(d.kind).toBe('ask');
    if (d.kind === 'ask') expect(d.options.map((o) => o.id)).toEqual(['a', 'b', 'c']);
  });
  it('binds when the runner-up is just outside the margin; confidence = best / total', () => {
    const d = decide([C('a', 1), C('b', 0.84)], cfg);
    expect(d).toMatchObject({ kind: 'bind', best: { id: 'a' } });
    if (d.kind === 'bind') expect(d.confidence).toBeCloseTo(1 / 1.84, 9);
  });
});

describe('dwellSegments', () => {
  it('merges consecutive samples on the same top hit and skips gaps', () => {
    const segs = dwellSegments(prepareSamples([S(0, 'a'), S(33, 'a'), S(66, null), S(99, 'b'), S(132, 'a')], cfg), [0, 1000], new Set(['a', 'b']));
    expect(segs.map((s) => [s.id, s.start, s.end])).toEqual([
      ['a', 0, 33],
      ['b', 99, 99],
      ['a', 132, 132],
    ]);
  });
});

describe('calibrateLag (fusion-engine 6.5)', () => {
  // "b" was dwelled 1000..1400, "a" 1500..1900. The word was first heard at 2300.
  const samples = [...Array.from({ length: 13 }, (_, i) => S(1000 + i * 33, 'b')), ...Array.from({ length: 13 }, (_, i) => S(1500 + i * 33, 'a'))];
  it('finds a lag that makes the chosen object win and nudges 30% toward it', () => {
    const r = calibrateLag({ samples, candidates: [SEL('a'), SEL('b')], seen: 2300, chosenId: 'b', cfg });
    expect(r).not.toBeNull();
    expect(r!.target).toBeGreaterThan(cfg.lagMs);
    expect(r!.lagMs).toBeCloseTo(cfg.lagMs + 0.3 * (r!.target - cfg.lagMs), 9);
    // At the target lag "b" really does win.
    const tWord = 2300 - r!.target;
    const ranked = scoreCandidates(prepareSamples(samples, cfg), cfg, { tWord, window: [tWord - 800, tWord + 300], flat: false, candidates: [SEL('a'), SEL('b')] });
    expect(ranked[0]!.id).toBe('b');
  });
  it('returns null when no lag in range makes the chosen object win', () => {
    expect(calibrateLag({ samples, candidates: [SEL('a'), SEL('b'), SEL('z')], seen: 2300, chosenId: 'z', cfg })).toBeNull();
  });
});

describe('word timing details (fusion-engine 6.1-6.3)', () => {
  it('trackInterim fills only the first `timedCount` slots', () => {
    const tr = trackInterim(newTrack('en', 0), 'compare this', 500, 1);
    expect(tr.firstSeen).toEqual([500]);
    expect(trackInterim(tr, 'compare this with that', 900, 2).firstSeen).toEqual([500, 900]);
  });
  it('interim estimates never go before speech start', () => {
    const tr = trackInterim(newTrack('en', 1000), 'that', 1100, 1);
    expect(estimateWordTimes({ track: tr, finalT: 1500, tokenIndices: [0], tokenCount: 1, lagMs: 350 }).times).toEqual([1000]);
  });
  it('without a start event the utterance is assumed to start 2 s before the final', () => {
    const w = estimateWordTimes({ track: null, finalT: 5000, tokenIndices: [0], tokenCount: 1, lagMs: 0 });
    expect(w.times[0]).toBeCloseTo(3000 + 2000 * 0.5, 9);
  });
  it('VAD: voiced time is walked across segments and clipped to the utterance', () => {
    const tr = newTrack('en', 1000);
    const w = estimateWordTimes({ track: tr, finalT: 3000, tokenIndices: [2], tokenCount: 4, lagMs: 0, vad: [{ start: 500, end: 1400 }, { start: 2000, end: 2400 }] });
    // voiced: 1000..1400 (400 ms) + 2000..2400 (400 ms); p = 2.5/4 -> 500 ms into voiced time -> 2100
    expect(w.times[0]).toBeCloseTo(2100, 9);
    expect(w.method).toEqual(['vad']);
  });
  it('interim and VAD are averaged when both exist', () => {
    const tr = trackInterim(newTrack('en', 1000), 'that', 1800, 1);
    const w = estimateWordTimes({ track: tr, finalT: 3000, tokenIndices: [0], tokenCount: 1, lagMs: 300, vad: [{ start: 1000, end: 2000 }] });
    expect(w.method).toEqual(['interim+vad']);
    expect(w.times[0]).toBeCloseTo((1500 + 1500) / 2, 9);
  });
});
