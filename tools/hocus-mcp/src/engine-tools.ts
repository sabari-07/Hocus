import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import {
  DEFAULT_CONFIG,
  createEngine,
  lintLexicon,
  parse,
  parseReplayFile,
  patchConfig,
  replay,
  resolveFrame,
  withWordTimes,
  type AppDefinition,
  type FusionConfig,
  type HocusEvent,
  type LangCode,
  type PointerSample,
  type Resolution,
} from '@hocus/core';
import { roomApp } from '../../../apps/room-designer/src/app.ts';
import { planetApp } from '../../../apps/planet-explorer/src/app.ts';
import { kitchenApp } from '../../../examples/kitchen-board/src/app.ts';

/** Pure functions behind the MCP tools (also unit-tested without MCP). */
export const APPS: Record<string, AppDefinition<unknown>> = {
  'room-designer': roomApp as AppDefinition<unknown>,
  'planet-explorer': planetApp as AppDefinition<unknown>,
  'kitchen-board': kitchenApp as AppDefinition<unknown>,
};

export function appOrThrow(id: string) {
  const app = APPS[id];
  if (!app) throw new Error(`Unknown app "${id}". Known: ${Object.keys(APPS).join(', ')}`);
  return app;
}

export function listApps() {
  return Object.values(APPS).map((a) => ({
    id: a.id,
    title: a.title,
    selectables: a.selectables(a.initialState).map((s) => `${s.id} (${s.label})`),
    actions: Object.fromEntries(Object.entries(a.actions).map(([k, v]) => [k, { slots: v.slots, requires: v.requires, examples: v.examples?.en ?? [] }])),
  }));
}

export interface DwellSpec {
  /** Selectable id, or null for empty space. */
  id: string | null;
  startMs: number;
  endMs: number;
  /** Pointer speed in px/ms (0 = still). */
  speed?: number;
  conf?: number;
}

/** Build 30 Hz pointer samples from a dwell timeline. */
export function samplesFromDwells(dwells: DwellSpec[]): PointerSample[] {
  const out: PointerSample[] = [];
  let x = 100;
  for (const d of [...dwells].sort((a, b) => a.startMs - b.startMs))
    for (let t = d.startMs; t < d.endMs; t += 1000 / 30) {
      x += (d.speed ?? 0) * (1000 / 30);
      out.push({ t, x, y: 300, conf: d.conf ?? 1, source: 'hand', pose: 'point', hits: d.id ? [{ id: d.id, quality: 1 }] : [], place: { surface: 'floor', world: { x: x / 100, y: 0, z: 0 } } });
    }
  return out;
}

export function resolveUtterance(input: {
  app: string;
  utterance: string;
  wordTimesMs: number[];
  dwells: DwellSpec[];
  lang?: LangCode;
  config?: Partial<FusionConfig>;
  lastActed?: string[];
}): { parse: unknown; resolution?: Resolution } {
  const app = appOrThrow(input.app);
  const engine = createEngine(app);
  const state = { ...engine.initial(), lang: input.lang ?? 'en' };
  const parsed = parse(input.utterance, engine.parseContext(state));
  if (parsed.type !== 'frame') return { parse: parsed };
  const frame = withWordTimes(parsed.frame, input.wordTimesMs, input.wordTimesMs[0] ?? 0);
  const spec = app.actions[frame.action];
  if (!spec) return { parse: parsed };
  const resolution = resolveFrame(frame, spec, {
    samples: samplesFromDwells(input.dwells),
    selectables: engine.selectables(state),
    selection: { ids: [], t: 0 },
    lastActed: input.lastActed ?? [],
    names: engine.parseContext(state).names,
    config: patchConfig(DEFAULT_CONFIG, input.config ?? {}),
    typed: false,
    tFinal: Math.max(...input.wordTimesMs, 0) + 400,
  });
  return { parse: { type: 'frame', action: frame.action, slots: frame.slots }, resolution };
}

export function runReplay(path: string) {
  const file = parseReplayFile(JSON.parse(readFileSync(resolvePath(path), 'utf8')));
  const app = appOrThrow(file.app);
  const engine = createEngine(app);
  const { state } = replay(engine, file.events as HocusEvent[], engine.initial({ lang: file.lang, config: file.config as never }));
  const got = state.decisions.map((d) => ({
    seq: d.seq,
    raw: d.raw,
    outcome: d.outcome,
    ...(d.resolution.status === 'resolved' ? { bindings: d.resolution.bindings } : {}),
  }));
  const expected = file.expected?.decisions ?? [];
  const diffs = got
    .map((g, i) => ({ i, got: g, want: expected[i] }))
    .filter(({ got: g, want }) => !want || g.raw !== want.raw || g.outcome !== want.outcome || JSON.stringify(g.bindings ?? null) !== JSON.stringify(want.bindings ?? null));
  return { app: file.app, origin: file.origin, events: file.events.length, decisions: got, matches: diffs.length === 0 && got.length === expected.length, diffs, state };
}

export function explain(path: string, seq?: number) {
  const r = runReplay(path);
  const d = seq != null ? r.state.decisions.find((x) => x.seq === seq) : r.state.decisions.at(-1);
  if (!d) throw new Error('No decision found');
  return {
    seq: d.seq,
    raw: d.raw,
    outcome: d.outcome,
    params: { windowBefore: d.params.windowBefore, windowAfter: d.params.windowAfter, minEvidence: d.params.minEvidence, margin: d.params.margin, lagMs: d.params.lagMs },
    words: d.resolution.words.map((w) => ({
      slot: w.slot,
      word: w.word,
      tWord: w.tWord,
      window: w.window,
      via: w.via,
      binding: w.binding,
      candidates: w.candidates.slice(0, 5).map((c) => ({ id: c.id, evidence: +c.evidence.toFixed(4), ...c.parts, samples: c.samples })),
    })),
    status: d.resolution.status,
  };
}

export function lint(appId?: string) {
  return lintLexicon(appId ? appOrThrow(appId) : undefined);
}
