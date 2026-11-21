import { bindingToArg, type ActionArgs, type ActionContext, type ActionSpec, type AppDefinition } from './app.ts';
import { calibrateLag } from './calibration.ts';
import { DEFAULT_CONFIG, patchConfig } from './config.ts';
import { decide, dwellSegments, prepareSamples, scoreCandidates } from './evidence.ts';
import { getPack } from './lexicon/index.ts';
import { joinOptions, msg } from './messages.ts';
import { parse, timedWords, tokenize, withWordTimes, type ParseContext } from './parser.ts';
import { resolveFrame, type SlotSpec } from './resolver.ts';
import { estimateWordTimes, newTrack, trackInterim, type UtteranceTrack } from './timing.ts';
import type {
  Binding,
  CandidateEvidence,
  CommandFrame,
  DecisionRecord,
  Effect,
  FusionConfig,
  HocusEvent,
  LangCode,
  Millis,
  PointerSample,
  Resolution,
  Selectable,
  SpeechEvent,
  SurfacePoint,
} from './types.ts';

// ---------------------------------------------------------------- state

/** The undoable document: app state plus user-given names. */
export interface Doc<S> {
  app: S;
  /** lowercase name -> id */
  names: Record<string, string>;
  /** id -> display name */
  display: Record<string, string>;
}

/** Everything needed to re-resolve a command later (ask answers, repair, X-ray). */
export interface Snapshot {
  frame: CommandFrame;
  samples: PointerSample[];
  selection: { ids: string[]; t: Millis; place?: SurfacePoint };
  lasso?: { ids: string[]; t: Millis };
  lastActed: string[];
  typed: boolean;
  tFinal: Millis;
  /** Raw interim first-seen time per timed word (for self-calibration). */
  wordSeen: Array<Millis | null>;
  exclude: string[];
}

export interface Pending {
  action: string;
  args: ActionArgs;
  ids: string[];
  sentence: string;
  seq: number;
  snapshot?: Snapshot;
  resolution?: Extract<Resolution, { status: 'resolved' }>;
}

export type Phase =
  | { kind: 'idle' }
  | { kind: 'listening'; since: Millis }
  | { kind: 'preview'; until: Millis; pending: Pending }
  | { kind: 'confirm'; until: Millis; pending: Pending }
  | { kind: 'ask'; until: Millis; snapshot: Snapshot; slot: string; options: CandidateEvidence[]; partial: Record<string, Binding>; seq: number };

export interface LastAction {
  pending: Pending;
  mutated: boolean;
}

export interface CoreState<S> {
  doc: Doc<S>;
  past: Doc<S>[];
  future: Doc<S>[];
  t: Millis;
  buffer: PointerSample[];
  selection: { ids: string[]; t: Millis; place?: SurfacePoint };
  lasso?: { ids: string[]; t: Millis };
  track: UtteranceTrack | null;
  phase: Phase;
  lastActed: string[];
  last?: LastAction;
  config: FusionConfig;
  lang: LangCode;
  decisions: DecisionRecord[];
  seq: number;
  /** Transcript of the current/last utterance, for the speech bar. */
  transcript: string;
}

export interface StepResult<S> {
  state: CoreState<S>;
  effects: Effect[];
}

export interface Engine<S> {
  app: AppDefinition<S>;
  initial(opts?: { lang?: LangCode; config?: Partial<FusionConfig>; t?: Millis }): CoreState<S>;
  step(state: CoreState<S>, event: HocusEvent): StepResult<S>;
  /** Helpers for UIs (pure). */
  selectables(state: CoreState<S>): Selectable[];
  labelOf(state: CoreState<S>, id: string): string;
  parseContext(state: CoreState<S>): ParseContext;
  /** Re-resolve a decision with different parameters (live tuning, no side effects). */
  reresolve(record: DecisionRecord, patch: Partial<FusionConfig>): Resolution | null;
}

const MAX_HISTORY = 100;
const MAX_DECISIONS = 20;

const NAME_SPEC: SlotSpec = { slots: { target: 'object', name: 'name' } };

// ---------------------------------------------------------------- engine

export function createEngine<S>(app: AppDefinition<S>, baseConfig: Partial<FusionConfig> = {}): Engine<S> {
  const selectablesOf = (s: CoreState<S>) => app.selectables(s.doc.app);

  const labelOf = (s: CoreState<S>, id: string): string => {
    const disp = s.doc.display[id];
    if (disp) return disp;
    return selectablesOf(s).find((x) => x.id === id)?.label ?? id;
  };

  /** User names + unique labels -> id. */
  const namesMap = (s: CoreState<S>): Record<string, string> => {
    const out: Record<string, string> = {};
    const counts = new Map<string, number>();
    const sels = selectablesOf(s);
    for (const x of sels) counts.set(x.label.toLowerCase(), (counts.get(x.label.toLowerCase()) ?? 0) + 1);
    for (const x of sels) if (counts.get(x.label.toLowerCase()) === 1) out[x.label.toLowerCase()] = x.id;
    for (const [n, id] of Object.entries(s.doc.names)) out[n] = id;
    return out;
  };

  const parseContext = (s: CoreState<S>): ParseContext => ({
    pack: getPack(s.lang),
    actions: app.actions as ParseContext['actions'],
    vocab: app.vocabulary?.[s.lang],
    names: namesMap(s),
    kinds: Object.keys(app.entities ?? {}),
  });

  const actionCtx = (s: CoreState<S>): ActionContext => ({
    labelOf: (id) => labelOf(s, id),
    lang: s.lang,
    selectables: selectablesOf(s),
  });

  const specOf = (action: string): SlotSpec | undefined =>
    action === '__name' ? NAME_SPEC : (app.actions[action] as SlotSpec | undefined);

  function initial(opts: { lang?: LangCode; config?: Partial<FusionConfig>; t?: Millis } = {}): CoreState<S> {
    return {
      doc: { app: app.initialState, names: {}, display: {} },
      past: [],
      future: [],
      t: opts.t ?? 0,
      buffer: [],
      selection: { ids: [], t: 0 },
      track: null,
      phase: { kind: 'idle' },
      lastActed: [],
      config: patchConfig(DEFAULT_CONFIG, { ...baseConfig, ...(opts.config ?? {}) }),
      lang: opts.lang ?? 'en',
      decisions: [],
      seq: 0,
      transcript: '',
    };
  }

  function step(state: CoreState<S>, event: HocusEvent): StepResult<S> {
    const t = eventTime(event);
    let s: CoreState<S> = t > state.t ? { ...state, t } : state;
    const fx: Effect[] = [];
    switch (event.type) {
      case 'pointer': {
        const cutoff = event.sample.t - s.config.bufferMs;
        const buffer = s.buffer.filter((p) => p.t >= cutoff);
        buffer.push(event.sample);
        s = { ...s, buffer };
        break;
      }
      case 'speech':
        s = onSpeech(s, event.speech, fx);
        break;
      case 'select': {
        const ids =
          event.mode === 'clear' ? [] : event.mode === 'add' ? [...new Set([...s.selection.ids, ...event.ids])] : [...event.ids];
        s = { ...s, selection: { ids, t: event.t, ...(event.place ? { place: event.place } : {}) } };
        fx.push({ type: 'highlight', ids, mode: ids.length ? 'locked' : 'clear' });
        break;
      }
      case 'lasso':
        s = { ...s, lasso: { ids: [...event.ids], t: event.t } };
        fx.push({ type: 'highlight', ids: event.ids, mode: 'locked' });
        break;
      case 'key':
        s = onKey(s, event.intent, event.index, fx);
        break;
      case 'gesture':
        s = onKey(s, event.gesture, undefined, fx);
        break;
      case 'tick':
        s = onTick(s, fx);
        break;
      case 'calibrate': {
        const lagMs = Math.min(s.config.lagMax, Math.max(s.config.lagMin, event.lagMs));
        s = { ...s, config: { ...s.config, lagMs } };
        fx.push({ type: 'calibrated', lagMs });
        break;
      }
      case 'config':
        s = { ...s, config: patchConfig(s.config, event.patch) };
        break;
      case 'lang':
        s = { ...s, lang: event.lang, track: null };
        break;
      case 'command':
        s = onCommand(s, event.action, event.args, fx);
        break;
    }
    return { state: s, effects: fx };
  }

  // ------------------------------------------------------------ speech

  function onSpeech(s: CoreState<S>, ev: SpeechEvent, fx: Effect[]): CoreState<S> {
    switch (ev.kind) {
      case 'start':
        return {
          ...s,
          track: newTrack(ev.lang, ev.t),
          transcript: '',
          phase: s.phase.kind === 'idle' ? { kind: 'listening', since: ev.t } : s.phase,
        };
      case 'interim': {
        const text = ev.text ?? '';
        const track = s.track ?? newTrack(ev.lang, null);
        const count = timedWords(text, parseContext(s)).length;
        return { ...s, track: trackInterim(track, text, ev.t, count), transcript: text };
      }
      case 'end':
        return { ...s, phase: s.phase.kind === 'listening' ? { kind: 'idle' } : s.phase };
      case 'final':
      case 'typed': {
        const text = ev.text ?? '';
        const track = s.track;
        const cleared: CoreState<S> = {
          ...s,
          track: null,
          transcript: text,
          phase: s.phase.kind === 'listening' ? { kind: 'idle' } : s.phase,
        };
        return onUtterance(cleared, text, ev.t, ev.kind === 'typed', track, ev.vad, fx);
      }
    }
  }

  function stripWakeWord(s: CoreState<S>, text: string): string | null {
    if (!s.config.requireWakeWord) return text;
    const { norm, orig } = tokenize(text, getPack(s.lang));
    const wake = s.config.wakeWord.toLowerCase();
    if (norm[0] !== wake) return null;
    return orig.slice(1).join(' ');
  }

  function onUtterance(
    s0: CoreState<S>,
    rawText: string,
    t: Millis,
    typed: boolean,
    track: UtteranceTrack | null,
    vad: SpeechEvent['vad'],
    fx: Effect[],
  ): CoreState<S> {
    const text = typed ? rawText : stripWakeWord(s0, rawText);
    if (text === null || !text.trim()) return s0;
    let s = s0;
    const ctx = parseContext(s);
    const parsed = parse(text, ctx);

    if (parsed.type === 'control') {
      const tWord = typed ? t : t - s.config.lagMs;
      return onControl(s, parsed.intent, tWord, typed, fx);
    }
    if (parsed.type === 'no_action') {
      const seq = s.seq + 1;
      const record: DecisionRecord = {
        seq,
        t,
        raw: text,
        lang: s.lang,
        resolution: { status: 'no_action', hint: parsed.hint, words: [] },
        params: s.config,
        samples: [],
        selectables: selectablesOf(s),
        outcome: 'no_action',
      };
      s = pushDecision({ ...s, seq }, record, fx);
      fx.push({ type: 'announce', text: msg(s.lang, 'notUnderstood', { a: parsed.hint }), politeness: 'polite' });
      fx.push({ type: 'sound', name: 'error' });
      return s;
    }

    // Word times for every timed word, in spoken order.
    const timed = timedWords(text, ctx);
    const { norm } = tokenize(text, ctx.pack);
    let times: number[];
    let seen: Array<Millis | null>;
    if (typed) {
      times = timed.map(() => t);
      seen = timed.map(() => null);
    } else {
      const est = estimateWordTimes({
        track,
        finalT: t,
        tokenIndices: timed.map((w) => w.tokenIndex),
        tokenCount: norm.length,
        lagMs: s.config.lagMs,
        ...(vad ? { vad } : {}),
      });
      times = est.times;
      seen = est.seen;
    }
    const frame = withWordTimes(parsed.frame, times, typed ? t : t - s.config.lagMs);
    const snapshot: Snapshot = {
      frame,
      samples: s.buffer.filter((p) => p.t >= t - s.config.bufferMs),
      selection: s.selection,
      ...(s.lasso ? { lasso: s.lasso } : {}),
      lastActed: s.lastActed,
      typed,
      tFinal: t,
      wordSeen: seen,
      exclude: [],
    };
    return propose(s, snapshot, {}, fx);
  }

  // ------------------------------------------------------------ resolve -> preview / ask / confirm

  function runResolve(s: CoreState<S>, snap: Snapshot, forced: Record<string, Binding>): Resolution {
    const spec = specOf(snap.frame.action);
    if (!spec) return { status: 'no_action', hint: 'unknown action', words: [] };
    return resolveFrame(snap.frame, spec, {
      samples: snap.samples,
      selectables: selectablesOf(s),
      selection: snap.selection,
      ...(snap.lasso ? { lasso: snap.lasso } : {}),
      lastActed: snap.lastActed,
      names: namesMap(s),
      config: s.config,
      typed: snap.typed,
      tFinal: snap.tFinal,
      exclude: snap.exclude,
      forced,
    });
  }

  function propose(s0: CoreState<S>, snap: Snapshot, forced: Record<string, Binding>, fx: Effect[]): CoreState<S> {
    let s = s0;
    const res = runResolve(s, snap, forced);
    const seq = s.seq + 1;
    s = { ...s, seq };
    const outcome: DecisionRecord['outcome'] =
      res.status === 'resolved' ? 'preview' : res.status === 'ask' ? 'ask' : res.status === 'no_target' ? 'no_target' : 'no_action';
    const record: DecisionRecord = {
      seq,
      t: s.t,
      raw: snap.frame.raw,
      lang: s.lang,
      frame: snap.frame,
      resolution: res,
      params: s.config,
      samples: snap.samples,
      selectables: selectablesOf(s),
      outcome,
      context: {
        typed: snap.typed,
        tFinal: snap.tFinal,
        selection: snap.selection,
        ...(snap.lasso ? { lasso: snap.lasso } : {}),
        lastActed: snap.lastActed,
        exclude: snap.exclude,
        names: namesMap(s),
      },
    };

    if (res.status === 'resolved') {
      const spec = specOf(snap.frame.action)!;
      const args: ActionArgs = {};
      const ids: string[] = [];
      for (const [slot, b] of Object.entries(res.bindings)) {
        args[slot] = bindingToArg(b);
        const kind = spec.slots[slot];
        if (kind === 'object' && b.kind === 'object') ids.push(b.id);
        if (kind === 'objects' && b.kind === 'objects') ids.push(...b.ids);
      }
      const pending: Pending = {
        action: snap.frame.action,
        args,
        ids: [...new Set(ids)],
        sentence: describe(s, snap.frame.action, args),
        seq,
        snapshot: snap,
        resolution: res,
      };
      const full = app.actions[snap.frame.action] as ActionSpec<S> | undefined;
      const needsConfirm = !!full && (full.alwaysConfirm || (full.destructive && pending.ids.length > 1));
      if (needsConfirm) {
        record.outcome = 'confirm';
        s = pushDecision(s, record, fx);
        fx.push({ type: 'highlight', ids: pending.ids, mode: 'locked' });
        fx.push({ type: 'announce', text: msg(s.lang, 'confirmDestructive', { a: pending.sentence }), politeness: 'assertive' });
        fx.push({ type: 'sound', name: 'ask' });
        return { ...s, phase: { kind: 'confirm', until: s.t + s.config.confirmTimeoutMs, pending } };
      }
      s = pushDecision(s, record, fx);
      fx.push({ type: 'highlight', ids: pending.ids, mode: 'locked' });
      fx.push({ type: 'announce', text: pending.sentence, politeness: 'polite' });
      fx.push({ type: 'sound', name: 'lock' });
      if (s.config.previewMs <= 0) return execute(s, pending, fx);
      return { ...s, phase: { kind: 'preview', until: s.t + s.config.previewMs, pending } };
    }

    s = pushDecision(s, record, fx);
    if (res.status === 'ask') {
      const labels = res.options.map((o) => labelOf(s, o.id));
      fx.push({ type: 'highlight', ids: res.options.map((o) => o.id), mode: 'ambiguous' });
      fx.push({ type: 'announce', text: msg(s.lang, 'didYouMean', { list: joinOptions(s.lang, labels) }), politeness: 'assertive' });
      fx.push({ type: 'sound', name: 'ask' });
      return {
        ...s,
        phase: {
          kind: 'ask',
          until: s.t + s.config.askTimeoutMs,
          snapshot: snap,
          slot: res.slot,
          options: res.options,
          partial: { ...res.partial, ...forced },
          seq,
        },
      };
    }
    if (res.status === 'no_target') {
      const kind = specOf(snap.frame.action)?.slots[res.slot];
      const role = res.words[res.words.length - 1]?.role;
      const key = kind === 'place' ? 'pointPlace' : role === 'quantity' || kind === 'quantity' ? 'showSize' : snap.exclude.length ? 'nothingElse' : 'pointFirst';
      fx.push({ type: 'announce', text: msg(s.lang, key), politeness: 'assertive' });
      fx.push({ type: 'sound', name: 'error' });
      fx.push({ type: 'highlight', ids: [], mode: 'clear' });
      return { ...s, phase: { kind: 'idle' } };
    }
    // no_action after parsing (e.g. type constraint excluded a named object)
    const named = res.words[res.words.length - 1]?.word ?? '';
    fx.push({
      type: 'announce',
      text: res.hint === 'cannotDo' ? msg(s.lang, 'cannotDo', { a: named }) : msg(s.lang, 'notUnderstood', { a: res.hint }),
      politeness: 'polite',
    });
    fx.push({ type: 'sound', name: 'error' });
    return { ...s, phase: { kind: 'idle' } };
  }

  function describe(s: CoreState<S>, action: string, args: ActionArgs): string {
    if (action === '__name') return `${labelOf(s, String(args.target))} → ${String(args.name)}`;
    const spec = app.actions[action];
    if (spec?.describe) return spec.describe(args, actionCtx(s));
    const parts = Object.values(args)
      .map((a) => (typeof a === 'string' ? labelOf(s, a) : Array.isArray(a) ? a.map((i) => labelOf(s, i)).join(', ') : ''))
      .filter(Boolean);
    return `${action} ${parts.join(' ')}`.trim();
  }

  // ------------------------------------------------------------ execute

  function execute(s0: CoreState<S>, pending: Pending, fx: Effect[]): CoreState<S> {
    let s = s0;
    if (pending.action === '__name') {
      const id = String(pending.args.target);
      const name = String(pending.args.name);
      const lower = name.toLowerCase();
      const names = { ...s.doc.names };
      const display = { ...s.doc.display };
      const prevOwner = names[lower];
      if (prevOwner) delete display[prevOwner];
      for (const [n, owner] of Object.entries(names)) if (owner === id) delete names[n];
      const before = labelOf(s, id);
      names[lower] = id;
      display[id] = name;
      const doc: Doc<S> = { ...s.doc, names, display };
      s = pushHistory(s, doc);
      fx.push({ type: 'executed', action: '__name', args: { ...pending.args }, ids: [id] });
      fx.push({ type: 'announce', text: msg(s.lang, 'named', { a: before, b: name }), politeness: 'polite' });
      fx.push({ type: 'sound', name: 'run' });
      fx.push({ type: 'highlight', ids: [], mode: 'clear' });
      return finish(s, pending, true);
    }
    const spec = app.actions[pending.action] as ActionSpec<S>;
    const ctx = actionCtx(s);
    const nextApp = spec.reduce(s.doc.app, pending.args, ctx);
    const mutates = spec.mutates !== false;
    if (mutates) s = pushHistory(s, { ...s.doc, app: nextApp });
    else s = { ...s, doc: { ...s.doc, app: nextApp } };
    const reply = spec.respond?.(s.doc.app, pending.args, actionCtx(s));
    fx.push({ type: 'executed', action: pending.action, args: { ...pending.args }, ids: pending.ids });
    fx.push({ type: 'sound', name: 'run' });
    fx.push({ type: 'highlight', ids: [], mode: 'clear' });
    if (reply) {
      fx.push({ type: 'announce', text: reply, politeness: 'polite' });
      fx.push({ type: 'speak', text: reply });
    } else fx.push({ type: 'announce', text: `${pending.sentence}. ${msg(s.lang, 'done')}`, politeness: 'polite' });
    return finish(s, pending, mutates);
  }

  function finish(s: CoreState<S>, pending: Pending, mutated: boolean): CoreState<S> {
    return {
      ...s,
      phase: { kind: 'idle' },
      lastActed: pending.ids.length ? pending.ids : s.lastActed,
      last: { pending, mutated },
      lasso: undefined,
    };
  }

  function pushHistory(s: CoreState<S>, doc: Doc<S>): CoreState<S> {
    const past = [...s.past, s.doc];
    if (past.length > MAX_HISTORY) past.shift();
    return { ...s, doc, past, future: [] };
  }

  function pushDecision(s: CoreState<S>, record: DecisionRecord, fx: Effect[]): CoreState<S> {
    fx.push({ type: 'decision', record });
    const decisions = [...s.decisions, record];
    if (decisions.length > MAX_DECISIONS) decisions.shift();
    return { ...s, decisions };
  }

  // ------------------------------------------------------------ control, keys, ticks

  function cancelPhase(s: CoreState<S>, fx: Effect[], announce = true): CoreState<S> {
    if (s.phase.kind === 'idle' || s.phase.kind === 'listening') return s;
    if (announce) {
      fx.push({ type: 'announce', text: msg(s.lang, 'cancelled'), politeness: 'polite' });
      fx.push({ type: 'sound', name: 'cancel' });
    }
    fx.push({ type: 'highlight', ids: [], mode: 'clear' });
    return { ...s, phase: { kind: 'idle' } };
  }

  function undo(s0: CoreState<S>, fx: Effect[]): CoreState<S> {
    const s = cancelPhase(s0, fx, false);
    const prev = s.past[s.past.length - 1];
    if (!prev) {
      fx.push({ type: 'announce', text: msg(s.lang, 'nothingToUndo'), politeness: 'polite' });
      return s;
    }
    fx.push({ type: 'announce', text: msg(s.lang, 'undone'), politeness: 'polite' });
    fx.push({ type: 'executed', action: '__undo', args: {}, ids: [] });
    return { ...s, doc: prev, past: s.past.slice(0, -1), future: [s.doc, ...s.future] };
  }

  function redo(s0: CoreState<S>, fx: Effect[]): CoreState<S> {
    const s = cancelPhase(s0, fx, false);
    const next = s.future[0];
    if (!next) {
      fx.push({ type: 'announce', text: msg(s.lang, 'nothingToRedo'), politeness: 'polite' });
      return s;
    }
    fx.push({ type: 'announce', text: msg(s.lang, 'redone'), politeness: 'polite' });
    fx.push({ type: 'executed', action: '__redo', args: {}, ids: [] });
    return { ...s, doc: next, past: [...s.past, s.doc], future: s.future.slice(1) };
  }

  function chooseOption(s: CoreState<S>, index: number, fx: Effect[]): CoreState<S> {
    if (s.phase.kind !== 'ask') return s;
    const opt = s.phase.options[index];
    if (!opt) return s;
    const { snapshot, slot, partial } = s.phase;
    const kind = specOf(snapshot.frame.action)?.slots[slot];
    const b: Binding = kind === 'objects' ? { kind: 'objects', ids: [opt.id] } : { kind: 'object', id: opt.id };
    return propose({ ...s, phase: { kind: 'idle' } }, snapshot, { ...partial, [slot]: b }, fx);
  }

  function onControl(s: CoreState<S>, intent: import('./types.ts').ControlIntent, tWord: Millis, typed: boolean, fx: Effect[]): CoreState<S> {
    switch (intent.kind) {
      case 'yes':
        return onKey(s, 'confirm', undefined, fx);
      case 'cancel':
        return cancelPhase(s, fx);
      case 'undo':
        return undo(s, fx);
      case 'redo':
        return redo(s, fx);
      case 'neither':
        return s.phase.kind === 'ask' ? cancelPhase(s, fx) : s;
      case 'choose':
        return chooseOption(s, intent.index, fx);
      case 'thisOne': {
        if (s.phase.kind !== 'ask') return s;
        const options = s.phase.options;
        const sels = selectablesOf(s).filter((x) => options.some((o) => o.id === x.id));
        const prepared = prepareSamples(s.buffer, s.config);
        const window: [Millis, Millis] = typed
          ? [s.t - s.config.typedLookback, s.t]
          : [tWord - s.config.windowBefore, tWord + s.config.windowAfter];
        const ranked = scoreCandidates(prepared, s.config, { tWord, window, flat: typed, candidates: sels });
        const d = decide(ranked, s.config);
        if (d.kind !== 'bind') return s;
        return chooseOption(s, options.findIndex((o) => o.id === d.best.id), fx);
      }
      case 'whatWasThat': {
        const prepared = prepareSamples(s.buffer, s.config);
        const allowed = new Set(selectablesOf(s).map((x) => x.id));
        const segs = dwellSegments(prepared, [s.t - s.config.bufferMs, s.t], allowed).filter((g) => g.score >= s.config.minEvidence);
        const lastSeg = segs[segs.length - 1];
        const text = lastSeg ? msg(s.lang, 'thatWas', { a: labelOf(s, lastSeg.id) }) : msg(s.lang, 'nothingPointed');
        fx.push({ type: 'announce', text, politeness: 'polite' });
        fx.push({ type: 'speak', text });
        return s;
      }
      case 'otherOne':
      case 'notThat':
        return repair(s, intent.kind, fx);
    }
  }

  /** "no, the other one" / "not that" (requirements 5.6, 5.7, 6.5). */
  function repair(s0: CoreState<S>, kind: 'otherOne' | 'notThat', fx: Effect[]): CoreState<S> {
    let s = s0;
    // Source: a pending preview, or the last executed action.
    let pending: Pending | undefined;
    let fromPreview = false;
    if (s.phase.kind === 'preview' || s.phase.kind === 'confirm') {
      pending = s.phase.pending;
      fromPreview = true;
    } else pending = s.last?.pending;
    const snap = pending?.snapshot;
    const res = pending?.resolution;
    if (!pending || !snap || !res) {
      fx.push({ type: 'announce', text: msg(s.lang, 'nothingElse'), politeness: 'polite' });
      return s;
    }
    const word = res.words.find((w) => w.via === 'pointing' && w.binding?.kind === 'object' && w.candidates.length >= 1);
    const chosen = word?.binding?.kind === 'object' ? word.binding.id : pending.ids[0];
    if (!chosen) {
      fx.push({ type: 'announce', text: msg(s.lang, 'nothingElse'), politeness: 'polite' });
      return s;
    }
    if (fromPreview) s = { ...s, phase: { kind: 'idle' } };
    else if (s.last?.mutated) s = undo(s, []);

    const exclude = [...snap.exclude, chosen];
    if (kind === 'notThat') {
      return propose({ ...s, last: undefined }, { ...snap, exclude }, {}, fx);
    }
    const next = word?.candidates.find((c) => !exclude.includes(c.id));
    if (!word || !next) {
      fx.push({ type: 'announce', text: msg(s.lang, 'nothingElse'), politeness: 'polite' });
      return s;
    }
    // Self-calibration: which lag would have made `next` win?
    const order = (() => {
      const v = snap.frame.slots[word.slot];
      return v && (v.type === 'deictic' || v.type === 'anaphor') ? v.order : -1;
    })();
    const seen = order >= 0 ? snap.wordSeen[order] : null;
    if (!snap.typed && seen != null) {
      const cands = selectablesOf(s);
      const cal = calibrateLag({ samples: snap.samples, candidates: cands, seen, chosenId: next.id, cfg: s.config });
      if (cal) {
        s = { ...s, config: { ...s.config, lagMs: cal.lagMs } };
        fx.push({ type: 'calibrated', lagMs: cal.lagMs });
      }
    }
    const kindOf = specOf(snap.frame.action)?.slots[word.slot];
    const forcedBinding: Binding = kindOf === 'objects' ? { kind: 'objects', ids: [next.id] } : { kind: 'object', id: next.id };
    return propose({ ...s, last: undefined }, { ...snap, exclude }, { [word.slot]: forcedBinding }, fx);
  }

  function onKey(s: CoreState<S>, intent: string, index: number | undefined, fx: Effect[]): CoreState<S> {
    switch (intent) {
      case 'confirm':
        if (s.phase.kind === 'preview' || s.phase.kind === 'confirm') return execute(s, s.phase.pending, fx);
        return s;
      case 'cancel':
        return cancelPhase(s, fx);
      case 'undo':
        return undo(s, fx);
      case 'redo':
        return redo(s, fx);
      case 'choose':
        return index == null ? s : chooseOption(s, index, fx);
      default:
        return s;
    }
  }

  function onTick(s: CoreState<S>, fx: Effect[]): CoreState<S> {
    const p = s.phase;
    if (p.kind === 'preview' && s.t >= p.until) return execute(s, p.pending, fx);
    if (p.kind === 'ask' && s.t >= p.until) {
      fx.push({ type: 'highlight', ids: [], mode: 'clear' });
      return { ...s, phase: { kind: 'idle' } }; // expires quietly (5.8)
    }
    if (p.kind === 'confirm' && s.t >= p.until) return cancelPhase(s, fx); // never executes on timeout (5.5)
    return s;
  }

  /** Direct command from keyboard/mouse UI (modality parity). Args are already concrete. */
  function onCommand(s: CoreState<S>, action: string, args: Record<string, unknown>, fx: Effect[]): CoreState<S> {
    const spec = specOf(action);
    if (!spec) return s;
    const ids: string[] = [];
    for (const [slot, kind] of Object.entries(spec.slots)) {
      const a = args[slot];
      if (kind === 'object' && typeof a === 'string') ids.push(a);
      if (kind === 'objects' && Array.isArray(a)) ids.push(...a.filter((x): x is string => typeof x === 'string'));
    }
    const seq = s.seq + 1;
    const pending: Pending = { action, args: args as ActionArgs, ids, sentence: describe(s, action, args as ActionArgs), seq };
    const full = app.actions[action] as ActionSpec<S> | undefined;
    const next = { ...s, seq };
    if (full && (full.alwaysConfirm || (full.destructive && ids.length > 1))) {
      fx.push({ type: 'announce', text: msg(s.lang, 'confirmDestructive', { a: pending.sentence }), politeness: 'assertive' });
      return { ...next, phase: { kind: 'confirm', until: s.t + s.config.confirmTimeoutMs, pending } };
    }
    return execute(next, pending, fx);
  }

  function reresolve(record: DecisionRecord, patch: Partial<FusionConfig>): Resolution | null {
    if (!record.frame) return null;
    const spec = specOf(record.frame.action);
    if (!spec) return null;
    return reresolveRecord(record, spec, patch);
  }

  return {
    app,
    initial,
    step,
    selectables: selectablesOf,
    labelOf,
    parseContext,
    reresolve,
  };
}

/** Re-run the resolver on a recorded decision with patched parameters. Pure (requirement 7.3). */
export function reresolveRecord(record: DecisionRecord, spec: SlotSpec, patch: Partial<FusionConfig>): Resolution | null {
  if (!record.frame) return null;
  const c = record.context;
  return resolveFrame(record.frame, spec, {
    samples: record.samples,
    selectables: record.selectables,
    selection: c?.selection ?? { ids: [], t: 0 },
    ...(c?.lasso ? { lasso: c.lasso } : {}),
    lastActed: c?.lastActed ?? [],
    names: c?.names ?? Object.fromEntries(record.selectables.map((x) => [x.label.toLowerCase(), x.id])),
    config: patchConfig(record.params, patch),
    typed: c?.typed ?? false,
    tFinal: c?.tFinal ?? record.t,
    exclude: c?.exclude ?? [],
  });
}

export function eventTime(e: HocusEvent): Millis {
  switch (e.type) {
    case 'pointer':
      return e.sample.t;
    case 'speech':
      return e.speech.t;
    default:
      return e.t;
  }
}

/** Fold an event log (requirement 1.3/1.4). */
export function replay<S>(engine: Engine<S>, events: readonly HocusEvent[], init?: CoreState<S>) {
  let state = init ?? engine.initial();
  const effects: Effect[] = [];
  for (const e of events) {
    const r = engine.step(state, e);
    state = r.state;
    effects.push(...r.effects);
  }
  return { state, effects };
}
