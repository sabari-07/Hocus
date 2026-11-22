import { createRoot } from 'react-dom/client';
import { HocusApp, SceneList, appLinks, type JudgeStep } from '@hocus/ui';
import { BODIES, QUIZ, SOURCE, body, compareBodies, planetApp } from './app.ts';
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

const fmt = (n: number | null) => (n == null ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: 1 }));

createRoot(document.getElementById('root')!).render(
  <HocusApp
    app={planetApp}
    stage={{ label: 'A 3D solar system: the Sun, eight planets and the Moon, which you can point at', cameraPosition: [2.5, 22, 26], lookAt: [2.5, 0, 1.7], fov: 45, bloom: { strength: 0.6, radius: 0.5, threshold: 0.85 }, margin: 22 }}
    createScene={createPlanetScene}
    judge={JUDGE}
    links={appLinks()}
    topExtra={(rt) => (
      <>
        <button className="hx-btn hx-btn--ghost" aria-pressed={rt.state.doc.app.trueScale} onClick={() => rt.command('scaleMode', { on: !rt.state.doc.app.trueScale })}>
          ⚖ True scale
        </button>
        <button className="hx-btn hx-btn--ghost" onClick={() => rt.command('quiz', { on: !rt.state.doc.app.quiz })}>
          ❓ Quiz
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
            <section aria-label="Comparison">
              <h2>
                {cmp[0].name} vs {cmp[1].name}
              </h2>
              <table>
                <thead>
                  <tr>
                    <th scope="col" />
                    <th scope="col">{cmp[0].name}</th>
                    <th scope="col">{cmp[1].name}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><th scope="row">Diameter (km)</th><td>{fmt(cmp[0].diameterKm)}</td><td>{fmt(cmp[1].diameterKm)}</td></tr>
                  <tr><th scope="row">From Sun (M km)</th><td>{fmt(cmp[0].distanceMkm)}</td><td>{fmt(cmp[1].distanceMkm)}</td></tr>
                  <tr><th scope="row">Day (hours)</th><td>{fmt(cmp[0].dayHours)}</td><td>{fmt(cmp[1].dayHours)}</td></tr>
                  <tr><th scope="row">Year (days)</th><td>{fmt(cmp[0].yearDays)}</td><td>{fmt(cmp[1].yearDays)}</td></tr>
                  <tr><th scope="row">Moons</th><td>{fmt(cmp[0].moons)}</td><td>{fmt(cmp[1].moons)}</td></tr>
                </tbody>
              </table>
              <p className="hx-small">{compareBodies(cmp[0].id, cmp[1].id)}</p>
            </section>
          ) : info ? (
            <section aria-label={`About ${info.name}`}>
              <h2>{info.name}</h2>
              <table>
                <tbody>
                  <tr><th scope="row">Diameter</th><td>{fmt(info.diameterKm)} km</td></tr>
                  <tr><th scope="row">{info.kind === 'moon' ? 'From Earth' : 'From Sun'}</th><td>{info.kind === 'moon' ? `${fmt(info.distanceMkm * 1000)} thousand km` : `${fmt(info.distanceMkm)} million km`}</td></tr>
                  <tr><th scope="row">Day</th><td>{fmt(info.dayHours)} h</td></tr>
                  <tr><th scope="row">Year</th><td>{fmt(info.yearDays)} days</td></tr>
                  <tr><th scope="row">Moons</th><td>{fmt(info.moons)}</td></tr>
                  <tr><th scope="row">Mean temp.</th><td>{fmt(info.tempC)} °C</td></tr>
                </tbody>
              </table>
              <p className="hx-small">{info.fact}</p>
            </section>
          ) : (
            <section>
              <h2>Point &amp; Ask</h2>
              <p className="hx-small hx-muted">Point at a planet and say “what is that?”, or “compare this with that”.</p>
            </section>
          )}
          <SceneList title="Bodies" />
          <p className="hx-small hx-muted">
            Data: <a href={SOURCE.urls[0]} style={{ color: 'var(--hx-violet)' }}>{SOURCE.name}</a>, retrieved {SOURCE.retrieved}. Speed ×{sky.speed}.{' '}
            {BODIES.length} bodies.
          </p>
          <div className="hx-menu">
            <button className="hx-btn hx-btn--ghost" onClick={() => rt.command('slower', {})}>⏪ Slower</button>
            <button className="hx-btn hx-btn--ghost" onClick={() => rt.command('faster', {})}>⏩ Faster</button>
            <button className="hx-btn hx-btn--ghost" onClick={() => rt.command('reset', {})}>Reset view</button>
          </div>
        </div>
      );
    }}
  />,
);
