import { useMemo, useState } from 'react';
import { DEFAULT_CONFIG, parse, resolveFrame, withWordTimes, type Engine, type PointerSample, type Resolution } from '@hocus/core';
import { summarize } from './summary.ts';

interface Seg {
  target: string; // id or '' for nothing
  ms: number;
  fast: boolean;
}

/**
 * Timeline simulator (F5): build a pointer path and an utterance by hand and see how the
 * resolver decides, without any camera. Uses the app's real definition and the real resolver.
 */
export function Simulator<S>({ engine }: { engine: Engine<S> }) {
  const base = useMemo(() => engine.initial(), [engine]);
  const sels = engine.selectables(base);
  const [segs, setSegs] = useState<Seg[]>([
    { target: sels[0]?.id ?? '', ms: 500, fast: false },
    { target: sels[1]?.id ?? '', ms: 300, fast: true },
  ]);
  const [text, setText] = useState('make that bigger');
  const [wordAt, setWordAt] = useState(600);
  const [result, setResult] = useState<Resolution | null>(null);

  const run = () => {
    const samples: PointerSample[] = [];
    let t = 0;
    let x = 100;
    for (const s of segs) {
      const n = Math.max(1, Math.round(s.ms / 33));
      for (let i = 0; i < n; i++) {
        x += s.fast ? 60 : (i % 2 ? 1 : -1);
        samples.push({ t, x, y: 300, conf: 1, source: 'mouse', pose: 'point', hits: s.target ? [{ id: s.target, quality: 1 }] : [], place: { surface: 'floor', world: { x: x / 100, y: 0, z: 0 } } });
        t += 33;
      }
    }
    const parsed = parse(text, engine.parseContext(base));
    if (parsed.type !== 'frame') {
      setResult({ status: 'no_action', hint: parsed.type === 'control' ? 'control phrase' : parsed.hint, words: [] });
      return;
    }
    const frame = withWordTimes(parsed.frame, [wordAt, wordAt + 400, wordAt + 800], wordAt);
    const spec = engine.app.actions[frame.action];
    if (!spec) return;
    setResult(
      resolveFrame(frame, spec, {
        samples,
        selectables: sels,
        selection: { ids: [], t: 0 },
        lastActed: [],
        names: {},
        config: DEFAULT_CONFIG,
        typed: false,
        tFinal: t,
      }),
    );
  };

  return (
    <div className="hx-pad hx-stack">
      <ol className="hx-sim">
        {segs.map((s, i) => (
          <li key={i} className="hx-row">
            <select aria-label={`Segment ${i + 1} target`} value={s.target} onChange={(e) => setSegs((q) => q.map((v, k) => (k === i ? { ...v, target: e.target.value } : v)))}>
              <option value="">(nothing)</option>
              {sels.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
            <input aria-label={`Segment ${i + 1} duration (ms)`} type="number" min={33} max={3000} step={33} value={s.ms} onChange={(e) => setSegs((q) => q.map((v, k) => (k === i ? { ...v, ms: Number(e.target.value) } : v)))} />
            <label className="hx-check">
              <input type="checkbox" checked={s.fast} onChange={(e) => setSegs((q) => q.map((v, k) => (k === i ? { ...v, fast: e.target.checked } : v)))} />
              fast sweep
            </label>
            <button className="hx-btn hx-btn--ghost" aria-label={`Remove segment ${i + 1}`} onClick={() => setSegs((q) => q.filter((_, k) => k !== i))}>
              ✕
            </button>
          </li>
        ))}
      </ol>
      <div className="hx-row">
        <button className="hx-btn hx-btn--ghost" onClick={() => setSegs((q) => [...q, { target: '', ms: 300, fast: false }])}>
          + segment
        </button>
        <label className="hx-field hx-grow">
          <span>Utterance</span>
          <input value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <label className="hx-field">
          <span>First pointing word at (ms)</span>
          <input type="number" value={wordAt} step={10} onChange={(e) => setWordAt(Number(e.target.value))} />
        </label>
        <button className="hx-btn" onClick={run}>
          Run simulation
        </button>
      </div>
      {result && (
        <p className="hx-mono hx-small" aria-live="polite">
          {result.status}: {summarize(result)}
        </p>
      )}
    </div>
  );
}
