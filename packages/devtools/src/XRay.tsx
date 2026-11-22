import { useMemo, useState } from 'react';
import type { CandidateEvidence, DecisionRecord, Engine, FusionConfig, PointerSample, Resolution, WordResolution } from '@hocus/core';
import { Simulator } from './Simulator.tsx';
import { summarize } from './summary.ts';

const LANE_COLORS = ['#FFB347', '#4FE3C1', '#8E7CFF', '#FF8FB1', '#7FD1FF', '#E6E07A', '#B9F18C'];
const colorFor = (id: string, ids: string[]) => LANE_COLORS[Math.max(0, ids.indexOf(id)) % LANE_COLORS.length]!;

export interface XRayProps<S> {
  engine: Engine<S>;
  decisions: DecisionRecord[];
  selected: number | null;
  onSelect: (seq: number) => void;
  onExport: () => void;
  onCopyTest: (record: DecisionRecord) => void;
  onLoadReplay: (json: unknown) => void;
  eventCount: number;
  labels: { title: string; pointed: string; words: string; decision: string; empty: string; exportReplay: string; copyTest: string; simulator: string; recorder: string };
}

type Tab = 'decision' | 'simulator' | 'recorder';

const TUNABLE: Array<{ key: keyof FusionConfig; label: string; min: number; max: number; step: number }> = [
  { key: 'windowBefore', label: 'Window before (ms)', min: 200, max: 2000, step: 50 },
  { key: 'windowAfter', label: 'Window after (ms)', min: 0, max: 800, step: 25 },
  { key: 'margin', label: 'Ask margin', min: 0, max: 0.6, step: 0.01 },
  { key: 'minEvidence', label: 'Min evidence', min: 0.01, max: 0.4, step: 0.01 },
  { key: 'stabilitySpeed', label: 'Stability speed (px/ms)', min: 0.1, max: 3, step: 0.05 },
  { key: 'lagMs', label: 'Speech lag (ms)', min: 100, max: 1200, step: 25 },
];

/** The X-ray decision viewer (F4 / F-U5). Draws the same records the property tests reason about. */
export function XRay<S>(p: XRayProps<S>) {
  const [tab, setTab] = useState<Tab>('decision');
  const record = p.decisions.find((d) => d.seq === p.selected) ?? p.decisions[p.decisions.length - 1];
  const [patch, setPatch] = useState<Partial<FusionConfig>>({});
  const [scrub, setScrub] = useState<number | null>(null);

  const tuned: Resolution | null = useMemo(() => {
    if (!record || !Object.keys(patch).length) return null;
    // Lag is applied by shifting estimated word times (spoken commands only).
    const lagShift = patch.lagMs != null && !record.context?.typed ? record.params.lagMs - patch.lagMs : 0;
    const shifted = lagShift && record.frame ? { ...record, frame: shiftFrame(record.frame, lagShift) } : record;
    return p.engine.reresolve(shifted, patch);
  }, [record, patch, p.engine]);

  return (
    <section className="hx-xray" aria-label={p.labels.title}>
      <div className="hx-xray__tabs" role="tablist">
        {(['decision', 'simulator', 'recorder'] as Tab[]).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className="hx-tab" onClick={() => setTab(k)}>
            {k === 'decision' ? p.labels.decision : k === 'simulator' ? p.labels.simulator : p.labels.recorder}
          </button>
        ))}
        <div className="hx-xray__history" aria-label="Recent decisions">
          {p.decisions.slice(-6).map((d) => (
            <button key={d.seq} className={`hx-pill hx-pill--${d.outcome}`} aria-pressed={record?.seq === d.seq} onClick={() => p.onSelect(d.seq)}>
              {d.raw.slice(0, 28) || '…'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'decision' &&
        (record ? (
          <div className="hx-xray__body">
            <Lanes record={record} resolution={tuned ?? record.resolution} scrub={scrub} labels={p.labels} />
            <div className="hx-xray__side">
              <label className="hx-field">
                <span>Scrub</span>
                <input
                  type="range"
                  min={-2600}
                  max={600}
                  step={10}
                  value={scrub ?? 0}
                  onChange={(e) => setScrub(Number(e.target.value))}
                  aria-valuetext={`${scrub ?? 0} ms from the command`}
                />
              </label>
              {TUNABLE.map((k) => (
                <label key={k.key} className="hx-field">
                  <span>
                    {k.label}: <b className="hx-mono">{String(patch[k.key] ?? record.params[k.key])}</b>
                  </span>
                  <input
                    type="range"
                    min={k.min}
                    max={k.max}
                    step={k.step}
                    value={Number(patch[k.key] ?? record.params[k.key])}
                    onChange={(e) => setPatch((q) => ({ ...q, [k.key]: Number(e.target.value) }))}
                  />
                </label>
              ))}
              <div className="hx-row">
                <button className="hx-btn hx-btn--ghost" onClick={() => setPatch({})} disabled={!Object.keys(patch).length}>
                  Reset tuning
                </button>
                <button className="hx-btn" onClick={p.onExport}>
                  {p.labels.exportReplay}
                </button>
                <button className="hx-btn" onClick={() => p.onCopyTest(record)}>
                  {p.labels.copyTest}
                </button>
              </div>
              <p className="hx-sr-summary" aria-live="polite">
                {summarize(tuned ?? record.resolution)}
              </p>
            </div>
          </div>
        ) : (
          <p className="hx-muted hx-pad">{p.labels.empty}</p>
        ))}

      {tab === 'simulator' && <Simulator engine={p.engine} />}

      {tab === 'recorder' && (
        <div className="hx-pad hx-stack">
          <p>
            <b className="hx-mono">{p.eventCount}</b> events recorded in this session (pointer samples, speech, keys).
          </p>
          <div className="hx-row">
            <button className="hx-btn" onClick={p.onExport}>
              {p.labels.exportReplay}
            </button>
            <label className="hx-btn hx-btn--ghost">
              Load replay…
              <input
                type="file"
                accept="application/json"
                className="hx-visually-hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) p.onLoadReplay(JSON.parse(await f.text()));
                }}
              />
            </label>
          </div>
          <p className="hx-muted">Exported replays can be dropped into tests/replays/ to become regression tests.</p>
        </div>
      )}
    </section>
  );
}

function shiftFrame(frame: NonNullable<DecisionRecord['frame']>, by: number) {
  const slots = Object.fromEntries(
    Object.entries(frame.slots).map(([k, v]) => [k, v.type === 'deictic' || v.type === 'anaphor' ? { ...v, tWord: v.tWord + by } : v]),
  );
  return { ...frame, slots };
}

function Lanes({ record, resolution, scrub, labels }: { record: DecisionRecord; resolution: Resolution; scrub: number | null; labels: XRayProps<unknown>['labels'] }) {
  const tEnd = record.context?.tFinal ?? record.t;
  const t0 = tEnd - 2600;
  const t1 = tEnd + 600;
  const W = 760;
  const x = (t: number) => ((t - t0) / (t1 - t0)) * W;
  const ids = record.selectables.map((s) => s.id);
  const label = (id: string) => record.selectables.find((s) => s.id === id)?.label ?? id;
  const segs = segments(record.samples.filter((s) => s.t >= t0 && s.t <= t1));
  const words = resolution.words.filter((w) => w.tWord != null);
  const main: WordResolution | undefined = resolution.words.find((w) => w.candidates.length);
  const maxE = Math.max(record.params.minEvidence * 2, ...(main?.candidates ?? []).map((c) => c.evidence));
  const scrubT = scrub != null ? tEnd + scrub : null;
  const atScrub = scrubT != null ? nearest(record.samples, scrubT) : null;

  return (
    <div className="hx-lanes">
      <svg viewBox={`0 0 ${W} 210`} role="img" aria-label={summarize(resolution)} className="hx-lanes__svg">
        <text x={0} y={14} className="hx-lane-title">{labels.pointed}</text>
        {segs.map((s, i) => (
          <g key={i}>
            <rect x={x(s.start)} y={22} width={Math.max(2, x(s.end) - x(s.start))} height={22} rx={4} fill={s.id ? colorFor(s.id, ids) : '#2a2238'} opacity={0.35 + 0.65 * s.stab} />
            {s.id && x(s.end) - x(s.start) > 50 && (
              <text x={x(s.start) + 4} y={37} className="hx-lane-label">
                {label(s.id)}
              </text>
            )}
          </g>
        ))}
        <text x={0} y={70} className="hx-lane-title">{labels.words}</text>
        {words.map((w, i) => (
          <g key={i}>
            {w.window && <rect x={x(w.window[0])} y={78} width={x(w.window[1]) - x(w.window[0])} height={22} fill="#8E7CFF" opacity={0.18} />}
            <line x1={x(w.tWord!)} x2={x(w.tWord!)} y1={74} y2={104} stroke="#FFB347" strokeWidth={2} />
            <text x={x(w.tWord!) + 4} y={94} className="hx-lane-label">
              {`"${w.word}" → ${w.binding?.kind === 'object' ? label(w.binding.id) : w.binding?.kind === 'objects' ? w.binding.ids.map(label).join(', ') : w.binding?.kind === 'place' ? 'place' : '?'}`}
            </text>
          </g>
        ))}
        <line x1={x(tEnd)} x2={x(tEnd)} y1={18} y2={108} stroke="#EDEAF7" strokeDasharray="3 3" opacity={0.5} />
        <text x={0} y={128} className="hx-lane-title">{labels.decision}: {resolution.status}</text>
        {(main?.candidates ?? []).slice(0, 4).map((c: CandidateEvidence, i) => (
          <g key={c.id}>
            <text x={0} y={150 + i * 16} className="hx-lane-label">{label(c.id)}</text>
            <rect x={110} y={140 + i * 16} width={(c.evidence / maxE) * (W - 200)} height={11} rx={3} fill={colorFor(c.id, ids)} />
            <text x={116 + (c.evidence / maxE) * (W - 200)} y={150 + i * 16} className="hx-lane-label hx-mono">
              {c.evidence.toFixed(3)}
            </text>
          </g>
        ))}
        <line x1={110 + (record.params.minEvidence / maxE) * (W - 200)} x2={110 + (record.params.minEvidence / maxE) * (W - 200)} y1={136} y2={206} stroke="#FF5D73" strokeDasharray="2 3" />
        {scrubT != null && <line x1={x(scrubT)} x2={x(scrubT)} y1={18} y2={108} stroke="#4FE3C1" strokeWidth={2} />}
      </svg>
      {atScrub && (
        <p className="hx-mono hx-small">
          {Math.round(scrub!)} ms: {atScrub.hits.length ? atScrub.hits.map((h) => `${label(h.id)} (${h.quality.toFixed(2)})`).join(', ') : 'nothing'} · {atScrub.source} · conf {atScrub.conf.toFixed(2)}
        </p>
      )}
    </div>
  );
}

function segments(samples: PointerSample[]) {
  const out: Array<{ id: string | null; start: number; end: number; stab: number }> = [];
  let prev: PointerSample | undefined;
  for (const s of samples) {
    const top = [...s.hits].sort((a, b) => b.quality - a.quality)[0];
    const id = top && top.quality > 0.3 ? top.id : null;
    const speed = prev ? Math.hypot(s.x - prev.x, s.y - prev.y) / Math.max(1, s.t - prev.t) : 0;
    const stab = 1 / (1 + (speed / 0.6) ** 2);
    const last = out[out.length - 1];
    if (last && last.id === id) {
      last.end = s.t;
      last.stab = (last.stab + stab) / 2;
    } else out.push({ id, start: s.t, end: s.t + 33, stab });
    prev = s;
  }
  return out;
}

function nearest(samples: PointerSample[], t: number) {
  let best: PointerSample | null = null;
  for (const s of samples) if (!best || Math.abs(s.t - t) < Math.abs(best.t - t)) best = s;
  return best;
}
