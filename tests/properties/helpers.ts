import {
  createEngine,
  parse,
  resolveFrame,
  withWordTimes,
  DEFAULT_CONFIG,
  type CommandFrame,
  type FusionConfig,
  type PointerSample,
  type Resolution,
} from '@hocus/core';
import { makeTestApp, samplesFromPath, waypointPath, type SimObject } from '@hocus/testkit';

export function setup(objects: SimObject[]) {
  const app = makeTestApp(objects);
  const engine = createEngine(app);
  return { app, engine };
}

/** Parse `text` against the test app and set every timed word's tWord. */
export function frameFor(objects: SimObject[], text: string, times: number[], lang: 'en' | 'hi' | 'ta' = 'en'): CommandFrame {
  const { engine } = setup(objects);
  const r = parse(text, engine.parseContext({ ...engine.initial(), lang }));
  if (r.type !== 'frame') throw new Error(`"${text}" did not parse to a frame (${r.type})`);
  return withWordTimes(r.frame, times, times[0] ?? 0);
}

export function resolveWith(
  objects: SimObject[],
  frame: CommandFrame,
  samples: PointerSample[],
  opts: { tFinal: number; typed?: boolean; lastActed?: string[]; config?: Partial<FusionConfig>; selection?: string[] } = { tFinal: 0 },
): Resolution {
  const { app, engine } = setup(objects);
  const spec = app.actions[frame.action]!;
  const state = engine.initial();
  return resolveFrame(frame, spec, {
    samples,
    selectables: engine.selectables(state),
    selection: { ids: opts.selection ?? [], t: 0 },
    lastActed: opts.lastActed ?? [],
    names: engine.parseContext(state).names,
    config: { ...DEFAULT_CONFIG, ...(opts.config ?? {}) },
    typed: opts.typed ?? false,
    tFinal: opts.tFinal,
  });
}

export function boundId(res: Resolution, slot: string): string | undefined {
  if (res.status !== 'resolved') return undefined;
  const b = res.bindings[slot];
  return b?.kind === 'object' ? b.id : undefined;
}

export const pathSamples = (objects: SimObject[], t0: number, points: Parameters<typeof waypointPath>[1], conf = 1) =>
  samplesFromPath(waypointPath(t0, points), objects, { conf });
