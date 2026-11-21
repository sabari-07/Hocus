import type { ActionSpec, AppVocabulary, SlotKind } from './app.ts';
import type { LexiconPack } from './lexicon/types.ts';
import type {
  CommandFrame,
  ControlIntent,
  DeicticRole,
  LangCode,
  ParseResult,
  SlotValue,
  SpatialRelation,
} from './types.ts';

/** Everything the parser needs; built by the engine from the app definition and current names. */
export interface ParseContext {
  pack: LexiconPack;
  actions: Record<string, Pick<ActionSpec<unknown>, 'slots' | 'optional' | 'defaults' | 'examples'>>;
  vocab?: AppVocabulary;
  /** Names and unique labels that can be said instead of pointing: lowercase phrase -> id. */
  names: Record<string, string>;
  /** Entity kinds that can be created ("a pumpkin") or referenced ("the pumpkin"). */
  kinds: string[];
}

// ---------------------------------------------------------------- tokens

type Tag =
  | { t: 'deictic'; role: DeicticRole; word: string; alsoAnaphor: boolean }
  | { t: 'anaphor'; plural: boolean; word: string }
  | { t: 'verb'; actions: string[] }
  | { t: 'color'; value: string }
  | { t: 'size'; factor: number }
  | { t: 'number'; value: number }
  | { t: 'ordinal'; index: number }
  | { t: 'bool'; value: boolean }
  | { t: 'spatial'; relation: SpatialRelation }
  | { t: 'noun'; kind: string }
  | { t: 'name'; id: string; name: string }
  | { t: 'all' }
  | { t: 'article'; definite: boolean }
  | { t: 'naming' }
  | { t: 'qhead' }
  | { t: 'filler' };

interface Entry {
  tokens: string[];
  tag: Tag;
  /** Lower number wins on equal length. */
  prio: number;
}

export interface TaggedToken {
  start: number;
  len: number;
  tag: Tag | { t: 'unknown'; word: string };
  /** Original-casing text of the span. */
  text: string;
  /** Normalized (lowercase, homophone-corrected) text of the span. */
  norm: string;
  quality: 'exact' | 'prefix' | 'fuzzy';
}

const PUNCT = /[.,!?;:"“”()[\]{}।॥…]/g;

export function tokenize(text: string, pack: LexiconPack): { norm: string[]; orig: string[] } {
  const cleaned = text.normalize('NFC').replace(/[’‘`]/g, "'").replace(PUNCT, ' ');
  const orig = cleaned.split(/\s+/).filter(Boolean);
  const norm = orig.map((w) => {
    const l = w.toLowerCase();
    return pack.homophones[l] ?? l;
  });
  return { norm, orig };
}

const split = (phrase: string) => phrase.normalize('NFC').toLowerCase().split(/\s+/).filter(Boolean);

function levenshtein1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

const LATIN = /^[a-z']+$/;

function buildEntries(ctx: ParseContext): Entry[] {
  const { pack, vocab } = ctx;
  const out: Entry[] = [];
  const add = (phrase: string, tag: Tag, prio: number) => {
    const tokens = split(phrase);
    if (tokens.length) out.push({ tokens, tag, prio });
  };
  for (const [name, id] of Object.entries(ctx.names)) add(name, { t: 'name', id, name }, 0);
  for (const d of pack.deictics)
    add(d.phrase, { t: 'deictic', role: d.role, word: d.phrase, alsoAnaphor: !!d.alsoAnaphor }, 1);
  for (const a of pack.anaphors) add(a.phrase, { t: 'anaphor', plural: a.plural, word: a.phrase }, 1);
  for (const [rel, phrases] of Object.entries(pack.spatial))
    for (const p of phrases) add(p, { t: 'spatial', relation: rel as SpatialRelation }, 2);
  for (const p of pack.naming) add(p, { t: 'naming' }, 2);

  const verbMap = new Map<string, Set<string>>();
  const addVerb = (phrase: string, action: string) => {
    if (phrase.startsWith('@')) return;
    const key = split(phrase).join(' ');
    if (!verbMap.has(key)) verbMap.set(key, new Set());
    verbMap.get(key)!.add(action);
  };
  for (const action of Object.keys(ctx.actions)) {
    for (const p of pack.verbs[action] ?? []) addVerb(p, action);
    for (const p of vocab?.verbs?.[action] ?? []) addVerb(p, action);
  }
  for (const [phrase, actions] of verbMap) add(phrase, { t: 'verb', actions: [...actions].sort() }, 3);

  for (const [p, v] of Object.entries(pack.colors)) add(p, { t: 'color', value: v }, 4);
  const s = pack.size;
  for (const p of s.double) add(p, { t: 'size', factor: 2 }, 4);
  for (const p of s.half) add(p, { t: 'size', factor: 0.5 }, 4);
  for (const p of s.muchUp) add(p, { t: 'size', factor: 1.6 }, 4);
  for (const p of s.muchDown) add(p, { t: 'size', factor: 0.6 }, 4);
  for (const p of s.up) add(p, { t: 'size', factor: 1.25 }, 5);
  for (const p of s.down) add(p, { t: 'size', factor: 0.8 }, 5);
  for (const p of pack.quantityHeads) add(p, { t: 'qhead' }, 6);
  for (const [kind, nouns] of Object.entries(vocab?.nouns ?? {}))
    if (ctx.kinds.includes(kind)) for (const n of nouns) add(n, { t: 'noun', kind }, 4);
  for (const [p, v] of Object.entries(pack.numbers)) add(p, { t: 'number', value: v }, 6);
  for (const [p, i] of Object.entries(pack.ordinals)) add(p, { t: 'ordinal', index: i }, 6);
  for (const p of pack.booleans.on) add(p, { t: 'bool', value: true }, 7);
  for (const p of pack.booleans.off) add(p, { t: 'bool', value: false }, 7);
  for (const p of pack.allWords) add(p, { t: 'all' }, 7);
  for (const p of pack.articles.indefinite) add(p, { t: 'article', definite: false }, 8);
  for (const p of pack.articles.definite) add(p, { t: 'article', definite: true }, 8);
  for (const p of pack.fillers) add(p, { t: 'filler' }, 9);
  return out;
}

function tokenMatches(tok: string, ph: string, pack: LexiconPack, allowFuzzy: boolean): TaggedToken['quality'] | null {
  if (tok === ph) return 'exact';
  if (pack.prefixMatch && [...ph].length >= 3 && tok.startsWith(ph)) return 'prefix';
  if (allowFuzzy && LATIN.test(tok) && tok.length >= 5 && ph.length >= 5 && levenshtein1(tok, ph)) return 'fuzzy';
  return null;
}

const QUALITY_RANK = { exact: 0, prefix: 1, fuzzy: 2 } as const;

/** Tag a token stream with greedy longest-match. Deterministic. */
export function tagTokens(norm: string[], orig: string[], ctx: ParseContext): TaggedToken[] {
  const entries = buildEntries(ctx);
  const out: TaggedToken[] = [];
  let i = 0;
  while (i < norm.length) {
    let best: { e: Entry; q: TaggedToken['quality'] } | null = null;
    for (const e of entries) {
      if (i + e.tokens.length > norm.length) continue;
      const fuzzyOk = e.tag.t === 'verb' || e.tag.t === 'noun' || e.tag.t === 'color' || e.tag.t === 'size';
      let worst: TaggedToken['quality'] = 'exact';
      let ok = true;
      for (let k = 0; k < e.tokens.length; k++) {
        const q = tokenMatches(norm[i + k]!, e.tokens[k]!, ctx.pack, fuzzyOk);
        if (!q) {
          ok = false;
          break;
        }
        if (QUALITY_RANK[q] > QUALITY_RANK[worst]) worst = q;
      }
      if (!ok) continue;
      if (
        !best ||
        e.tokens.length > best.e.tokens.length ||
        (e.tokens.length === best.e.tokens.length &&
          (QUALITY_RANK[worst] < QUALITY_RANK[best.q] ||
            (QUALITY_RANK[worst] === QUALITY_RANK[best.q] && e.prio < best.e.prio)))
      )
        best = { e, q: worst };
    }
    if (best) {
      out.push({
        start: i,
        len: best.e.tokens.length,
        tag: best.e.tag,
        text: orig.slice(i, i + best.e.tokens.length).join(' '),
        norm: norm.slice(i, i + best.e.tokens.length).join(' '),
        quality: best.q,
      });
      i += best.e.tokens.length;
    } else {
      out.push({ start: i, len: 1, tag: { t: 'unknown', word: orig[i]! }, text: orig[i]!, norm: norm[i]!, quality: 'exact' });
      i += 1;
    }
  }
  // "this big" -> quantity deictic; the head word is consumed.
  for (let k = 0; k + 1 < out.length; k++) {
    const a = out[k]!;
    const b = out[k + 1]!;
    if (a.tag.t === 'deictic' && a.tag.role === 'object') {
      const headWord = norm.slice(b.start, b.start + b.len).join(' ');
      if (ctx.pack.quantityHeads.includes(headWord)) {
        a.tag = { ...a.tag, role: 'quantity' };
        b.tag = { t: 'filler' };
      }
    }
  }
  return out;
}

/** Indices (in token order) of words that need a time: deictics and anaphors. Used by the timing module. */
export function timedWords(text: string, ctx: ParseContext): Array<{ word: string; tokenIndex: number }> {
  const { norm, orig } = tokenize(text, ctx.pack);
  return tagTokens(norm, orig, ctx)
    .filter((t) => t.tag.t === 'deictic' || t.tag.t === 'anaphor')
    .map((t) => ({ word: t.norm, tokenIndex: t.start }));
}

// ---------------------------------------------------------------- control

const CONTROL_ORDER: Array<[keyof LexiconPack['control'], (raw: string) => ControlIntent]> = [
  ['otherOne', () => ({ kind: 'otherOne' })],
  ['notThat', () => ({ kind: 'notThat' })],
  ['whatWasThat', () => ({ kind: 'whatWasThat' })],
  ['undo', () => ({ kind: 'undo' })],
  ['redo', () => ({ kind: 'redo' })],
  ['neither', () => ({ kind: 'neither' })],
  ['yes', () => ({ kind: 'yes' })],
  ['cancel', () => ({ kind: 'cancel' })],
  ['thisOne', () => ({ kind: 'thisOne' })],
];

function detectControl(norm: string[], pack: LexiconPack): ControlIntent | null {
  const soft = new Set(['please', 'hocus', 'हॉकस', 'ஹோகஸ்', ...pack.articles.definite]);
  const core = norm.filter((w) => !soft.has(w));
  const joined = core.join(' ');
  const joinedNoOne = core.filter((w) => w !== 'one' && w !== 'वाला' && w !== 'ஒன்று').join(' ');
  for (const [key, make] of CONTROL_ORDER) {
    const phrases = pack.control[key].map((p) => split(p).join(' '));
    if (phrases.includes(joined)) return make(joined);
  }
  for (const [phrase, index] of Object.entries(pack.ordinals))
    if (split(phrase).join(' ') === joinedNoOne && joinedNoOne) return { kind: 'choose', index };
  return null;
}

// ---------------------------------------------------------------- frames

const SIZE_TRIGGER = new Set(['@sizeUp', '@sizeDown']);

function actionTriggers(action: string, ctx: ParseContext): string[] {
  return [...(ctx.pack.verbs[action] ?? []), ...(ctx.vocab?.verbs?.[action] ?? [])];
}

interface Refs {
  objects: SlotValue[];
  plurals: SlotValue[];
  places: SlotValue[];
  quantities: SlotValue[];
  entityTypes: string[];
  colors: string[];
  sizes: number[];
  numbers: number[];
  bools: boolean[];
  unknown: string[];
  unknownOrig: string[];
}

function collectRefs(tags: TaggedToken[], ctx: ParseContext): Refs {
  const r: Refs = {
    objects: [],
    plurals: [],
    places: [],
    quantities: [],
    entityTypes: [],
    colors: [],
    sizes: [],
    numbers: [],
    bools: [],
    unknown: [],
    unknownOrig: [],
  };
  let order = 0;
  // First pass: turn tags into slot values (with order for timed words).
  type Item = { v: SlotValue; cls: 'object' | 'plural' | 'place' | 'quantity' } | { spatial: SpatialRelation } | null;
  const items: Item[] = [];
  for (let k = 0; k < tags.length; k++) {
    const tg = tags[k]!;
    const tag = tg.tag;
    const prev = tags[k - 1]?.tag;
    const prevArticle = prev && prev.t === 'article' ? prev : null;
    const prevAll = prev && prev.t === 'all';
    switch (tag.t) {
      case 'deictic': {
        const v: SlotValue = {
          type: 'deictic',
          word: tg.norm,
          role: tag.role,
          order: order++,
          tokenIndex: tg.start,
          tWord: Number.NaN,
          ...(tag.alsoAnaphor ? { alsoAnaphor: true } : {}),
        };
        const cls = tag.role === 'object' ? 'object' : tag.role === 'plural' ? 'plural' : tag.role;
        items.push({ v, cls });
        break;
      }
      case 'anaphor': {
        const v: SlotValue = {
          type: 'anaphor',
          word: tg.norm,
          plural: tag.plural,
          order: order++,
          tokenIndex: tg.start,
          tWord: Number.NaN,
        };
        items.push({ v, cls: tag.plural ? 'plural' : 'object' });
        break;
      }
      case 'name':
        items.push({ v: { type: 'named', name: tag.name }, cls: 'object' });
        break;
      case 'noun':
        if (prevAll) items.push({ v: { type: 'kind', kind: tag.kind, all: true }, cls: 'plural' });
        else if (prevArticle && !prevArticle.definite) {
          r.entityTypes.push(tag.kind);
          items.push(null);
        } else if (prevArticle && prevArticle.definite) items.push({ v: { type: 'kind', kind: tag.kind, all: false }, cls: 'object' });
        else {
          // Bare noun: can be a type to create or a reference; record both, the action decides.
          r.entityTypes.push(tag.kind);
          items.push({ v: { type: 'kind', kind: tag.kind, all: false }, cls: 'object' });
        }
        break;
      case 'spatial':
        items.push({ spatial: tag.relation });
        break;
      case 'color':
        r.colors.push(tag.value);
        break;
      case 'size':
        r.sizes.push(tag.factor);
        break;
      case 'number':
        r.numbers.push(tag.value);
        break;
      case 'bool':
        r.bools.push(tag.value);
        break;
      case 'unknown':
        r.unknown.push(tg.text.toLowerCase());
        r.unknownOrig.push(tg.text);
        break;
      default:
        break;
    }
  }
  // Second pass: attach references to spatial relations.
  const used = new Set<number>();
  for (let k = 0; k < items.length; k++) {
    const it = items[k];
    if (!it || !('spatial' in it)) continue;
    const need = it.spatial === 'between' ? 2 : 1;
    const refs: SlotValue[] = [];
    const dir = ctx.pack.postpositions ? -1 : 1;
    for (let j = k + dir; j >= 0 && j < items.length && refs.length < need; j += dir) {
      const c = items[j];
      if (!c || 'spatial' in c || used.has(j)) continue;
      if (c.cls === 'object' || c.cls === 'plural') {
        refs.push(c.v);
        used.add(j);
        if (c.cls === 'plural') break;
      } else break;
    }
    if (dir === -1) refs.reverse();
    if (refs.length) r.places.push({ type: 'spatial', relation: it.spatial, refs });
  }
  for (let k = 0; k < items.length; k++) {
    const it = items[k];
    if (!it || 'spatial' in it || used.has(k)) continue;
    if (it.cls === 'object') r.objects.push(it.v);
    else if (it.cls === 'plural') r.plurals.push(it.v);
    else if (it.cls === 'place') r.places.push(it.v);
    else r.quantities.push(it.v);
  }
  return r;
}

function available(kind: SlotKind, r: Refs, hasUnknown: boolean): number {
  switch (kind) {
    case 'object':
      return r.objects.length;
    case 'objects':
      return r.plurals.length + r.objects.length;
    case 'place':
      return r.places.length;
    case 'entityType':
      return r.entityTypes.length;
    case 'factor':
      return r.sizes.length;
    case 'quantity':
      return r.quantities.length;
    case 'number':
      return r.numbers.length;
    case 'color':
      return r.colors.length;
    case 'boolean':
      return r.bools.length;
    case 'name':
      return hasUnknown ? 1 : 0;
  }
}

export function parse(text: string, ctx: ParseContext): ParseResult {
  const raw = text.trim();
  const { norm, orig } = tokenize(raw, ctx.pack);
  if (!norm.length) return { type: 'no_action', hint: hintFor(ctx), raw, unknown: [] };

  const control = detectControl(norm, ctx.pack);
  if (control) return { type: 'control', intent: control, raw };

  const tags = tagTokens(norm, orig, ctx);
  const refs = collectRefs(tags, ctx);
  const lang: LangCode = ctx.pack.lang;

  // Naming: "call this one Boris" / "इसका नाम बोरिस रखो".
  if (tags.some((t) => t.tag.t === 'naming')) {
    const target = refs.objects[0] ?? refs.plurals[0];
    if (target && refs.unknownOrig.length) {
      const frame: CommandFrame = {
        action: '__name',
        slots: { target, name: { type: 'literal', value: refs.unknownOrig.join(' ') } },
        lang,
        raw,
        unknown: [],
      };
      return { type: 'frame', frame };
    }
  }

  // Score every action.
  const verbHits = new Map<string, number>();
  for (const tg of tags) if (tg.tag.t === 'verb') for (const a of tg.tag.actions) verbHits.set(a, (verbHits.get(a) ?? 0) + tg.len);

  let best: { action: string; score: number; verbs: number; idx: number } | null = null;
  const names = Object.keys(ctx.actions);
  names.forEach((action, idx) => {
    const spec = ctx.actions[action]!;
    const triggers = actionTriggers(action, ctx);
    let implicit = 0;
    if (triggers.includes('@color') && refs.colors.length) implicit += 2;
    if (triggers.some((t) => SIZE_TRIGGER.has(t)) && refs.sizes.length) implicit += 2;
    if (triggers.includes('@quantity') && refs.quantities.length) implicit += 5;
    const verbs = verbHits.get(action) ?? 0;
    if (!verbs && !implicit) return;
    let fit = 0;
    const counts: Partial<Record<SlotKind, number>> = {};
    for (const [slot, kind] of Object.entries(spec.slots)) {
      const used = counts[kind] ?? 0;
      const has = available(kind, refs, refs.unknown.length > 0) > used;
      counts[kind] = used + 1;
      if (has) fit += 1;
      else if (!(spec.optional ?? []).includes(slot) && !(spec.defaults && slot in spec.defaults)) {
        // A missing single object is allowed (implicit "it"), at a cost.
        fit -= kind === 'object' ? 1 : 2;
      }
    }
    const score = verbs * 3 + implicit + fit;
    if (
      !best ||
      score > best.score ||
      (score === best.score && verbs > best.verbs) ||
      (score === best.score && verbs === best.verbs && idx < best.idx)
    )
      best = { action, score, verbs, idx };
  });

  if (!best) return { type: 'no_action', hint: hintFor(ctx), raw, unknown: refs.unknown };
  const chosen: { action: string } = best;
  const spec = ctx.actions[chosen.action]!;

  // Fill slots in declaration order.
  const slots: Record<string, SlotValue> = {};
  const queues = {
    objects: [...refs.objects],
    plurals: [...refs.plurals],
    places: [...refs.places],
    quantities: [...refs.quantities],
    entityTypes: [...refs.entityTypes],
  };
  const objectsUsedAsType = new Set<string>();
  for (const [slot, kind] of Object.entries(spec.slots)) {
    let v: SlotValue | undefined;
    switch (kind) {
      case 'object': {
        // Skip bare-noun kind refs that were consumed as the entity type.
        const idx = queues.objects.findIndex((o) => !(o.type === 'kind' && objectsUsedAsType.has(o.kind)));
        v = idx >= 0 ? queues.objects.splice(idx, 1)[0] : undefined;
        break;
      }
      case 'objects':
        v = queues.plurals.shift() ?? queues.objects.shift();
        break;
      case 'place':
        v = queues.places.shift();
        break;
      case 'quantity':
        v = queues.quantities.shift();
        break;
      case 'entityType': {
        const k = queues.entityTypes.shift();
        if (k) {
          v = { type: 'literal', value: k };
          objectsUsedAsType.add(k);
        }
        break;
      }
      case 'factor':
        if (refs.sizes.length) v = { type: 'literal', value: refs.sizes.reduce((a, b) => a * b, 1) };
        break;
      case 'number':
        if (refs.numbers.length) v = { type: 'literal', value: refs.numbers[0]! };
        break;
      case 'color':
        if (refs.colors.length) v = { type: 'literal', value: refs.colors[0]! };
        break;
      case 'boolean':
        if (refs.bools.length) v = { type: 'literal', value: refs.bools[0]! };
        break;
      case 'name':
        if (refs.unknownOrig.length) v = { type: 'literal', value: refs.unknownOrig.join(' ') };
        break;
    }
    if (v) slots[slot] = v;
  }
  // If an entity type consumed a bare noun, drop the duplicate kind reference from object slots.
  for (const [slot, v] of Object.entries(slots))
    if (spec.slots[slot] === 'object' && v.type === 'kind' && objectsUsedAsType.has(v.kind)) delete slots[slot];

  const frame: CommandFrame = { action: chosen.action, slots, lang, raw, unknown: refs.unknown };
  return { type: 'frame', frame };
}

function hintFor(ctx: ParseContext): string {
  for (const spec of Object.values(ctx.actions)) {
    const ex = spec.examples?.[ctx.pack.lang]?.[0] ?? spec.examples?.en?.[0];
    if (ex) return ex;
  }
  return ctx.pack.lang === 'en' ? 'make that bigger' : '';
}

export type TimedSlot = Extract<SlotValue, { type: 'deictic' }> | Extract<SlotValue, { type: 'anaphor' }>;

/** All timed slot values (deictics and anaphors) of a frame, in spoken order. */
export function timedSlots(frame: CommandFrame): Array<[string, TimedSlot]> {
  const out: Array<[string, TimedSlot]> = [];
  const visit = (slot: string, v: SlotValue) => {
    if (v.type === 'deictic' || v.type === 'anaphor') out.push([slot, v]);
    if (v.type === 'spatial') v.refs.forEach((r) => visit(slot, r));
  };
  for (const [slot, v] of Object.entries(frame.slots)) visit(slot, v);
  return out.sort((a, b) => a[1].order - b[1].order);
}

/** Return a copy of the frame with tWord set on every timed slot from `times[order]`. */
export function withWordTimes(frame: CommandFrame, times: readonly number[], fallback: number): CommandFrame {
  const set = (v: SlotValue): SlotValue => {
    if (v.type === 'deictic' || v.type === 'anaphor') return { ...v, tWord: times[v.order] ?? fallback };
    if (v.type === 'spatial') return { ...v, refs: v.refs.map(set) };
    return v;
  };
  const slots: Record<string, SlotValue> = {};
  for (const [k, v] of Object.entries(frame.slots)) slots[k] = set(v);
  return { ...frame, slots };
}
