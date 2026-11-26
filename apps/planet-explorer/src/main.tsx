import { createRoot } from 'react-dom/client';
import { HocusApp, SceneList, appLinks, type JudgeStep } from '@hocus/ui';
import { BODIES, QUIZ, SOURCE, body, compareBodies, planetApp, type Body } from './app.ts';
import { createPlanetScene } from './scene.ts';

const JUDGE: JudgeStep[] = [
  { point: 'mars', say: 'what is that', caption: 'Point at Mars and ask “what is that?”', wait: 2600 },
  { point: 'mars', say: 'compare this', caption: '“compare this…”', wait: 300 },
  { point: 'earth', say: 'compare this with that', caption: '…“with that”. Two pointing words, bound in spoken order.', wait: 2600 },
  { point: 'jupiter', say: 'zoom in on that', caption: 'Fly to Jupiter.', wait: 2400 },
  { say: 'show its moons', caption: '“its” remembers what you just used.', wait: 2600 },
  { say: 'reset', caption: 'Back to the overview.', wait: 1200 },
  { say: 'start the quiz', caption: 'Quiz mode: Hocus asks, you point.', wait: 2600 },
  { point: 'venus', say: 'that one', caption: 'Point and say “that one”. Your turn!', wait: 2600 },
];

const fmt = (n: number | null, d = 1) => (n == null ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: d }));
const MAX_D = Math.max(...BODIES.filter((b) => b.kind === 'planet').map((b) => b.diameterKm));
const MAX_AU = Math.max(...BODIES.map((b) => b.distanceMkm));
const share = (v: number, max: number) => `${Math.max(2, Math.min(100, (v / max) * 100)).toFixed(1)}%`;

function Dot({ b }: { b: Body }) {
  return <span aria-hidden="true" style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: b.color, boxShadow: `0 0 10px ${b.color}`, marginRight: 8 }} />;
}

function Facts({ b }: { b: Body }) {
  return (
    <section aria-label={`About ${b.name}`}>
      <h2>
        <Dot b={b} />
        {b.name}
      </h2>
      <div className="hx-stat">
        <span className="hx-stat__value">{fmt(b.diameterKm, 0)} km</span>
        <span className="hx-stat__label">Diameter</span>
      </div>
      <div className="hx-bar2" aria-hidden="true">
        <i style={{ width: share(b.diameterKm, b.kind === 'star' ? b.diameterKm : MAX_D) }} />
      </div>
      <div className="hx-stat">
        <span className="hx-stat__value">{b.kind === 'moon' ? `${fmt(b.distanceMkm * 1000, 0)} k km` : `${fmt(b.distanceMkm)} M km`}</span>
        <span className="hx-stat__label">{b.kind === 'moon' ? 'From Earth' : 'From the Sun'}</span>
      </div>
      <div className="hx-bar2" aria-hidden="true">
        <i style={{ width: share(b.distanceMkm, MAX_AU) }} />
      </div>
      <dl className="hx-facts">
        <div><dt>Day</dt><dd>{fmt(b.dayHours)} h</dd></div>
        <div><dt>Year</dt><dd>{fmt(b.yearDays, 0)} d</dd></div>
        <div><dt>Moons</dt><dd>{fmt(b.moons, 0)}</dd></div>
        <div><dt>Mean temp.</dt><dd>{fmt(b.tempC, 0)} °C</dd></div>
      </dl>
      <p className="hx-small">{b.fact}</p>
    </section>
  );
}

function Versus({ a, b }: { a: Body; b: Body }) {
  const rows: Array<[string, number | null, number | null, string]> = [
    ['Diameter (km)', a.diameterKm, b.diameterKm, '0'],
    ['From Sun (M km)', a.distanceMkm, b.distanceMkm, '1'],
    ['Day (hours)', a.dayHours, b.dayHours, '1'],
    ['Year (days)', a.yearDays, b.yearDays, '0'],
    ['Moons', a.moons, b.moons, '0'],
  ];
  return (
    <section aria-label="Comparison">
      <h2>
        <Dot b={a} />
        {a.name} vs <span style={{ marginLeft: 6 }} />
        <Dot b={b} />
        {b.name}
      </h2>
      {rows.map(([label, x, y, d]) => {
        const max = Math.max(x ?? 0, y ?? 0, 1e-9);
        return (
          <div key={label} className="hx-vs">
            <span className="hx-stat__label">{label}</span>
            <div className="hx-vs__row">
              <span className="hx-mono hx-small">{fmt(x, Number(d))}</span>
              <div className="hx-bar2"><i style={{ width: share(x ?? 0, max), background: a.color }} /></div>
            </div>
            <div className="hx-vs__row">
              <span className="hx-mono hx-small">{fmt(y, Number(d))}</span>
              <div className="hx-bar2"><i style={{ width: share(y ?? 0, max), background: b.color }} /></div>
            </div>
          </div>
        );
      })}
      <p className="hx-small" aria-live="polite">{compareBodies(a.id, b.id)}</p>
    </section>
  );
}

createRoot(document.getElementById('root')!).render(
  <HocusApp
    app={planetApp}
    theme="observatory"
    rightLabel="Observatory"
    stage={{ label: 'A 3D solar system: the Sun, eight planets and the Moon, which you can point at', cameraPosition: [2.5, 22, 26], lookAt: [2.5, 0, 1.7], fov: 45, bloom: { strength: 0.6, radius: 0.5, threshold: 0.85 }, margin: 22 }}
    createScene={createPlanetScene}
    judge={JUDGE}
    links={appLinks()}
    topExtra={(rt) => (
      <>
        <button className="hx-tool" aria-pressed={rt.state.doc.app.trueScale} onClick={() => rt.command('scaleMode', { on: !rt.state.doc.app.trueScale })}>
          <span aria-hidden="true">⚖</span>
          <span className="hx-tool__label">True scale</span>
        </button>
        <button className="hx-tool" aria-pressed={!!rt.state.doc.app.quiz} onClick={() => rt.command('quiz', { on: !rt.state.doc.app.quiz })}>
          <span aria-hidden="true">❓</span>
          <span className="hx-tool__label">Quiz</span>
        </button>
      </>
    )}
    right={(rt, core) => {
      const sky = core.doc.app;
      const info = sky.info ? body(sky.info) : null;
      const cmp = sky.compare?.map(body);
      return (
        <div className="hx-info">
          {sky.quiz && (
            <section aria-label="Quiz" aria-live="polite">
              <h2>Quiz</h2>
              <p style={{ margin: 0, fontSize: 18 }}>{QUIZ[sky.quiz.index % QUIZ.length]!.q}</p>
              <p className="hx-small hx-muted">
                Score {sky.quiz.score} / {sky.quiz.asked} {sky.quiz.last === 'right' ? '✓ correct' : sky.quiz.last === 'wrong' ? '✗ try the next one' : ''}
              </p>
            </section>
          )}
          {cmp && cmp[0] && cmp[1] ? (
            <Versus a={cmp[0]} b={cmp[1]} />
          ) : info ? (
            <Facts b={info} />
          ) : (
            <section>
              <h2>Point &amp; Ask</h2>
              <p className="hx-small hx-muted">Point at a planet and say “what is that?”, or “compare this with that”. Time slows while you hold a planet, so it is easy to catch.</p>
            </section>
          )}
          <SceneList title="Bodies" />
          <div className="hx-menu">
            <button className="hx-btn hx-btn--ghost" onClick={() => rt.command('slower', {})}>⏪ Slower</button>
            <button className="hx-btn hx-btn--ghost" onClick={() => rt.command('faster', {})}>⏩ Faster ×{sky.speed}</button>
            <button className="hx-btn hx-btn--ghost" onClick={() => rt.command('reset', {})}>Reset view</button>
          </div>
          <p className="hx-small hx-muted">
            Data: <a href={SOURCE.urls[0]} style={{ color: 'var(--hx-violet)' }}>{SOURCE.name}</a>, retrieved {SOURCE.retrieved}.
          </p>
        </div>
      );
    }}
  />,
);
