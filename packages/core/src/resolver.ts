import type { ActionSpec, SlotKind } from './app.ts';
import { decide, dwellSegments, prepareSamples, scoreCandidates, timeWeight, type PreparedSample } from './evidence.ts';
import { spatialPlace } from './geometry.ts';
import type {
  Binding,
  CandidateEvidence,
  CommandFrame,
  FusionConfig,
  Millis,
  PointerSample,
  Resolution,
  Selectable,
  SlotValue,
  SurfacePoint,
  WordResolution,
} from './types.ts';

export type SlotSpec = Pick<ActionSpec<unknown>, 'slots' | 'optional' | 'defaults' | 'requires' | 'distinct'>;

export interface ResolveContext {
  samples: readonly PointerSample[];
  selectables: readonly Selectable[];
  selection: { ids: string[]; t: Millis; place?: SurfacePoint };
  lasso?: { ids: string[]; t: Millis };
  lastActed: string[];
  /** lowercase name or unique label -> id */
  names: Record<string, string>;
  config: FusionConfig;
  typed: boolean;
  tFinal: Millis;
  exclude?: readonly string[];
  forced?: Record<string, Binding>;
}

type Outcome =
  | { ok: true; binding: Binding; word: WordResolution; confidence?: number }
  | { ok: false; res: 'ask'; options: CandidateEvidence[]; word: WordResolution }
  | { ok: false; res: 'no_target'; word: WordResolution }
  | { ok: false; res: 'no_action'; hint: string; word: WordResolution };

/**
 * Resolve every slot of a frame to a binding (fusion-engine requirements 2-4).
 * Pure. The ONLY place where words become ids or places.
 */
export function resolveFrame(frame: CommandFrame, spec: SlotSpec, ctx: ResolveContext): Resolution {
  const cfg = ctx.config;
  const prepared = prepareSamples(ctx.samples, cfg);
  const exclude = new Set(ctx.exclude ?? []);
  const bound = new Set<string>();
  const words: WordResolution[] = [];
  const bindings: Record<string, Binding> = {};
  let confidence = 1;

  const objectWordsTotal = Object.values(frame.slots).filter(
    (v) => (v.type === 'deictic' && v.role === 'object') || v.type === 'anaphor',
  ).length;
  let objectWordIdx = 0;

  // Local (per-call) switch: spatial reference objects ignore the action's type constraint.
  let requiresActive = true;
  const candidatesFor = (kind: SlotKind, useRequires: boolean) =>
    ctx.selectables.filter(
      (s) =>
        (!useRequires || !requiresActive || !spec.requires || s.caps.includes(spec.requires)) &&
        !exclude.has(s.id) &&
        !(spec.distinct && (kind === 'object' || kind === 'objects') && bound.has(s.id)),
    );

  const typedSegments = ctx.typed
    ? (() => {
        const allowed = new Set(ctx.selectables.map((s) => s.id));
        const segs = dwellSegments(prepared, [ctx.tFinal - Math.max(3000, cfg.typedLookback), ctx.tFinal], allowed).filter(
          (s) => s.score >= cfg.minEvidence * 0.5,
        );
        // Distinct ids by last occurrence, chronological.
        const lastIdx = new Map<string, number>();
        segs.forEach((s, i) => lastIdx.set(s.id, i));
        return [...lastIdx.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
      })()
    : [];

  const windowFor = (tWord: Millis): [Millis, Millis] =>
    ctx.typed ? [ctx.tFinal - cfg.typedLookback, ctx.tFinal] : [tWord - cfg.windowBefore, tWord + cfg.windowAfter];

  const rank = (tWord: Millis, candidates: readonly Selectable[]) =>
    scoreCandidates(prepared, cfg, { tWord, window: windowFor(tWord), flat: ctx.typed, candidates });

  const selectionFor = (candidates: readonly Selectable[]) => {
    const ok = new Set(candidates.map((c) => c.id));
    return ctx.selection.ids.filter((id) => ok.has(id));
  };

  for (const [slot, kind] of Object.entries(spec.slots)) {
    const forced = ctx.forced?.[slot];
    if (forced) {
      bindings[slot] = forced;
      if (forced.kind === 'object') bound.add(forced.id);
      if (forced.kind === 'objects') forced.ids.forEach((i) => bound.add(i));
      words.push({ slot, word: '(chosen)', role: 'literal', candidates: [], binding: forced, via: 'selection' });
      continue;
    }
    let v: SlotValue | undefined = frame.slots[slot];
    const optional = (spec.optional ?? []).includes(slot);
    if (!v) {
      if (spec.defaults && slot in spec.defaults) {
        const d = spec.defaults[slot]!;
        if (typeof d === 'string' || typeof d === 'number' || typeof d === 'boolean') {
          bindings[slot] = { kind: 'value', value: d };
          continue;
        }
      }
      if (optional) continue;
      if (kind === 'object' || kind === 'objects') {
        // Implicit reference ("make bigger"): treat as "it" at the end of the utterance.
        v = {
          type: 'anaphor',
          word: '(implicit)',
          plural: kind === 'objects',
          order: -1,
          tokenIndex: -1,
          tWord: ctx.typed ? ctx.tFinal : ctx.tFinal - cfg.lagMs,
        };
      } else if (kind === 'place') {
        words.push({ slot, word: '(missing)', role: 'place', candidates: [], via: 'none' });
        return { status: 'no_target', slot, words };
      } else {
        words.push({ slot, word: '(missing)', role: 'literal', candidates: [], via: 'none' });
        return { status: 'no_action', hint: `missing ${slot}`, words };
      }
    }

    const out = resolveValue(slot, kind, v);
    words.push(out.word);
    if (!out.ok) {
      if (out.res === 'ask')
        return { status: 'ask', slot, options: out.options, reason: 'near-equal evidence', words, partial: { ...bindings } };
      if (out.res === 'no_target') return { status: 'no_target', slot, words };
      return { status: 'no_action', hint: out.hint, words };
    }
    let b = out.binding;
    if (kind === 'objects' && b.kind === 'object') b = { kind: 'objects', ids: [b.id] };
    if (kind === 'object' && b.kind === 'objects') b = { kind: 'object', id: b.ids[0]! };
    bindings[slot] = b;
    if (b.kind === 'object') bound.add(b.id);
    if (b.kind === 'objects') b.ids.forEach((i) => bound.add(i));
    if (out.confidence != null) confidence = Math.min(confidence, out.confidence);
  }
  return { status: 'resolved', bindings, confidence, words };

  // ------------------------------------------------------------ helpers (closures over ctx)

  function resolveValue(slot: string, kind: SlotKind, v: SlotValue): Outcome {
    switch (v.type) {
      case 'literal':
        return { ok: true, binding: { kind: 'value', value: v.value }, word: lit(slot, String(v.value)) };
      case 'ordinal':
        return { ok: false, res: 'no_action', hint: 'ordinal outside a question', word: lit(slot, `#${v.index}`) };
      case 'named': {
        const id = ctx.names[v.name.toLowerCase()];
        const cands = candidatesFor(kind, true);
        const word: WordResolution = { slot, word: v.name, role: 'named', candidates: [], via: 'name' };
        if (!id) return { ok: false, res: 'no_target', word };
        if (!cands.some((c) => c.id === id)) return { ok: false, res: 'no_action', hint: 'cannotDo', word };
        return { ok: true, binding: { kind: 'object', id }, word: { ...word, binding: { kind: 'object', id } } };
      }
      case 'kind':
        return resolveKind(slot, kind, v.kind, v.all);
      case 'spatial':
        return resolveSpatial(slot, v);
      case 'anaphor':
        return resolveAnaphor(slot, kind, v.word, v.plural, v.tWord);
      case 'deictic':
        switch (v.role) {
          case 'object':
            return resolveObjectWord(slot, kind, v.word, v.tWord, !!v.alsoAnaphor);
          case 'plural':
            return resolvePlural(slot, kind, v.word, v.tWord);
          case 'place':
            return resolvePlace(slot, v.word, v.tWord);
          case 'quantity':
            return resolveQuantity(slot, v.word, v.tWord);
        }
    }
  }

  function lit(slot: string, word: string): WordResolution {
    return { slot, word, role: 'literal', candidates: [], via: 'literal' };
  }

  function resolveObjectWord(slot: string, kind: SlotKind, word: string, tWord: Millis, alsoAnaphor: boolean): Outcome {
    const myIdx = objectWordIdx++;
    const cands = candidatesFor(kind, true);
    const ranked = rank(tWord, cands);
    const base: WordResolution = { slot, word, role: 'object', tWord, window: windowFor(tWord), candidates: ranked, via: 'none' };

    if (ctx.typed && objectWordsTotal > 1) {
      const ok = new Set(cands.map((c) => c.id));
      const segs = typedSegments.filter((id) => ok.has(id) && !bound.has(id));
      const need = objectWordsTotal - myIdx;
      const id = segs.length >= need ? segs[segs.length - need] : undefined;
      if (id) return { ok: true, binding: { kind: 'object', id }, word: { ...base, binding: { kind: 'object', id }, via: 'pointing' } };
    } else {
      const d = decide(ranked, cfg);
      if (d.kind === 'bind')
        return {
          ok: true,
          binding: { kind: 'object', id: d.best.id },
          confidence: d.confidence,
          word: { ...base, binding: { kind: 'object', id: d.best.id }, via: 'pointing' },
        };
      if (d.kind === 'ask') return { ok: false, res: 'ask', options: d.options, word: base };
    }
    const sel = selectionFor(cands).filter((id) => !bound.has(id));
    const fromSel = sel[objectWordsTotal > 1 ? Math.min(myIdx, sel.length - 1) : 0];
    if (fromSel) return { ok: true, binding: { kind: 'object', id: fromSel }, word: { ...base, binding: { kind: 'object', id: fromSel }, via: 'selection' } };
    if (alsoAnaphor) {
      const mem = ctx.lastActed.find((id) => cands.some((c) => c.id === id));
      if (mem) return { ok: true, binding: { kind: 'object', id: mem }, word: { ...base, binding: { kind: 'object', id: mem }, via: 'memory' } };
    }
    return { ok: false, res: 'no_target', word: base };
  }

  function resolveAnaphor(slot: string, kind: SlotKind, word: string, plural: boolean, tWord: Millis): Outcome {
    objectWordIdx++;
    const cands = candidatesFor(kind, true);
    const ok = new Set(cands.map((c) => c.id));
    const ranked = rank(tWord, cands);
    const base: WordResolution = { slot, word, role: 'anaphor', tWord, window: windowFor(tWord), candidates: ranked, via: 'none' };
    const d = decide(ranked, cfg);
    if (!plural && d.kind === 'bind' && d.best.evidence >= cfg.itOverrideEvidence)
      return {
        ok: true,
        binding: { kind: 'object', id: d.best.id },
        confidence: d.confidence,
        word: { ...base, binding: { kind: 'object', id: d.best.id }, via: 'pointing' },
      };
    const mem = ctx.lastActed.filter((id) => ok.has(id) && !bound.has(id));
    if (mem.length) {
      const binding: Binding = plural || kind === 'objects' ? { kind: 'objects', ids: mem } : { kind: 'object', id: mem[0]! };
      return { ok: true, binding, word: { ...base, binding, via: 'memory' } };
    }
    if (d.kind === 'bind')
      return {
        ok: true,
        binding: { kind: 'object', id: d.best.id },
        confidence: d.confidence,
        word: { ...base, binding: { kind: 'object', id: d.best.id }, via: 'pointing' },
      };
    if (d.kind === 'ask') return { ok: false, res: 'ask', options: d.options, word: base };
    const sel = selectionFor(cands).filter((id) => !bound.has(id));
    if (sel.length) {
      const binding: Binding = plural || kind === 'objects' ? { kind: 'objects', ids: sel } : { kind: 'object', id: sel[0]! };
      return { ok: true, binding, word: { ...base, binding, via: 'selection' } };
    }
    return { ok: false, res: 'no_target', word: base };
  }

  function resolvePlural(slot: string, kind: SlotKind, word: string, tWord: Millis): Outcome {
    const cands = candidatesFor(kind, true);
    const ok = new Set(cands.map((c) => c.id));
    const ranked = rank(tWord, cands);
    const base: WordResolution = { slot, word, role: 'plural', tWord, window: windowFor(tWord), candidates: ranked, via: 'none' };
    if (ctx.lasso && ctx.tFinal - ctx.lasso.t <= cfg.lassoFreshMs) {
      const ids = ctx.lasso.ids.filter((id) => ok.has(id));
      if (ids.length) return { ok: true, binding: { kind: 'objects', ids }, word: { ...base, binding: { kind: 'objects', ids }, via: 'lasso' } };
    }
    const strong = ranked.filter((c) => c.evidence >= cfg.minEvidence).map((c) => c.id);
    if (strong.length)
      return { ok: true, binding: { kind: 'objects', ids: strong }, word: { ...base, binding: { kind: 'objects', ids: strong }, via: 'pointing' } };
    const sel = selectionFor(cands);
    if (sel.length) return { ok: true, binding: { kind: 'objects', ids: sel }, word: { ...base, binding: { kind: 'objects', ids: sel }, via: 'selection' } };
    return { ok: false, res: 'no_target', word: base };
  }

  function resolveKind(slot: string, kind: SlotKind, entity: string, all: boolean): Outcome {
    const cands = candidatesFor(kind, true).filter((c) => c.kind === entity);
    const base: WordResolution = { slot, word: entity, role: 'kind', candidates: [], via: 'kind' };
    if (!cands.length) return { ok: false, res: 'no_target', word: base };
    if (all) {
      const ids = cands.map((c) => c.id);
      return { ok: true, binding: { kind: 'objects', ids }, word: { ...base, binding: { kind: 'objects', ids } } };
    }
    if (cands.length === 1) {
      const id = cands[0]!.id;
      return { ok: true, binding: { kind: 'object', id }, word: { ...base, binding: { kind: 'object', id } } };
    }
    const tWord = ctx.typed ? ctx.tFinal : ctx.tFinal - cfg.lagMs;
    const ranked = rank(tWord, cands);
    const d = decide(ranked, cfg);
    const word = { ...base, candidates: ranked, tWord, window: windowFor(tWord) };
    if (d.kind === 'bind') return { ok: true, binding: { kind: 'object', id: d.best.id }, word: { ...word, binding: { kind: 'object', id: d.best.id }, via: 'pointing' } };
    const options =
      d.kind === 'ask'
        ? d.options
        : cands.slice(0, 4).map((c) => ({ id: c.id, label: c.label, evidence: 0, parts: { time: 0, conf: 0, quality: 0, stability: 0 }, samples: 0 }));
    return { ok: false, res: 'ask', options, word };
  }

  function resolvePlace(slot: string, word: string, tWord: Millis): Outcome {
    const window = windowFor(tWord);
    const base: WordResolution = { slot, word, role: 'place', tWord, window, candidates: [], via: 'none' };
    let best: { p: PreparedSample; score: number } | null = null;
    for (const p of prepared) {
      const s = p.s;
      if (!s.place || s.t < window[0] || s.t > window[1] || s.pose !== 'point') continue;
      const score = timeWeight(s.t - tWord, cfg, ctx.typed) * p.stab * s.conf;
      if (score > 0 && (!best || score >= best.score)) best = { p, score };
    }
    if (best) {
      const s = best.p.s;
      const binding: Binding = { kind: 'place', x: s.x, y: s.y, world: s.place!.world, surface: s.place!.surface };
      return { ok: true, binding, word: { ...base, binding, via: 'pointing' } };
    }
    if (ctx.selection.place) {
      const sp = ctx.selection.place;
      const binding: Binding = { kind: 'place', x: 0, y: 0, world: sp.world, surface: sp.surface };
      return { ok: true, binding, word: { ...base, binding, via: 'selection' } };
    }
    return { ok: false, res: 'no_target', word: base };
  }

  function resolveQuantity(slot: string, word: string, tWord: Millis): Outcome {
    const lo = tWord - 300;
    const hi = tWord + 200;
    const vals = ctx.samples.filter((s) => s.t >= lo && s.t <= hi && typeof s.aperture === 'number').map((s) => s.aperture!);
    const base: WordResolution = { slot, word, role: 'quantity', tWord, window: [lo, hi], candidates: [], via: 'none' };
    if (!vals.length) return { ok: false, res: 'no_target', word: base };
    const value = Math.min(1, Math.max(0, vals.reduce((a, b) => a + b, 0) / vals.length));
    return { ok: true, binding: { kind: 'quantity', value }, word: { ...base, binding: { kind: 'quantity', value }, via: 'pointing' } };
  }

  function resolveSpatial(slot: string, v: Extract<SlotValue, { type: 'spatial' }>): Outcome {
    const base: WordResolution = { slot, word: v.relation, role: 'spatial', candidates: [], via: 'spatial' };
    const refs: Array<{ pos: { x: number; y: number; z: number }; size: number }> = [];
    for (const r of v.refs) {
      // References are not subject to the action's type constraint.
      requiresActive = false;
      const out = resolveValue(slot, 'objects', r);
      requiresActive = true;
      if (!out.ok) return out;
      const ids = out.binding.kind === 'object' ? [out.binding.id] : out.binding.kind === 'objects' ? out.binding.ids : [];
      for (const id of ids) {
        const s = ctx.selectables.find((x) => x.id === id);
        if (!s?.pos) return { ok: false, res: 'no_target', word: base };
        refs.push({ pos: s.pos, size: s.size ?? 1 });
      }
    }
    const world = spatialPlace(v.relation, refs);
    if (!world) return { ok: false, res: 'no_target', word: base };
    const binding: Binding = { kind: 'place', x: 0, y: 0, world, surface: 'spatial' };
    return { ok: true, binding, word: { ...base, binding } };
  }
}
