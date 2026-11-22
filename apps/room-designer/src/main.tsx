import { createRoot } from 'react-dom/client';
import { HocusApp, SceneList, appLinks, type JudgeStep } from '@hocus/ui';
import { CATALOG, TYPES, roomApp, type Room } from './app.ts';
import { createRoomScene } from './scene.ts';

/** Judge Mode: a scripted session that runs through the real engine and real 3D hit testing. */
const JUDGE: JudgeStep[] = [
  { point: 'pumpkin-1', say: 'make that bigger', caption: 'Point at the pumpkin and say “make that bigger”.' },
  { point: { x: 4, y: 0, z: 2 }, say: 'put it there', caption: '“put it there”: “it” is the pumpkin, “there” is where the finger points.' },
  { point: 'ghost-1', say: 'turn this green', caption: 'Colour words work too.' },
  { point: 'cat-1', say: 'call this one Boris', caption: 'Give things names…' },
  { say: 'make Boris bigger', caption: '…and use them later without pointing.' },
  { point: { x: -1.5, y: 0, z: 2 }, say: 'put a bat here', caption: 'Create new things where you point.' },
  { say: 'lights off', caption: 'The candles glow when the lights go out.', wait: 2200 },
  { say: 'lights on', caption: 'Say “undo” any time. Your turn!' },
];

const step = 0.8;
const nudge = (dx: number, dz: number) => (rt: { command: (a: string, args: Record<string, unknown>) => void; state: { doc: { app: Room }; selection: { ids: string[] } } }) => {
  const id = rt.state.selection.ids[0];
  const it = rt.state.doc.app.items.find((i) => i.id === id);
  if (it) rt.command('move', { target: id, destination: { x: 0, y: 0, world: { x: it.x + dx, y: it.y, z: it.z + dz }, surface: 'floor' } });
};

createRoot(document.getElementById('root')!).render(
  <HocusApp
    app={roomApp}
    stage={{ label: 'A 3D haunted room with props you can point at', cameraPosition: [0, 3.4, 9.2], lookAt: [0, 1.3, 0], fov: 46 }}
    createScene={createRoomScene}
    judge={JUDGE}
    links={appLinks()}
    topExtra={(rt) => (
      <button className="hx-btn hx-btn--ghost" onClick={() => { const a = document.createElement('a'); a.href = rt.stage!.snapshot(); a.download = 'haunted-room.png'; a.click(); }}>
        🖼 Export PNG
      </button>
    )}
    left={(rt) => (
      <nav aria-label="Crypt palette">
        <h2>Crypt</h2>
        <p className="hx-small hx-muted">Say “put a pumpkin there”, or click to add one in the middle.</p>
        <div className="hx-menu">
          {TYPES.map((t) => (
            <button key={t} className="hx-btn" onClick={() => rt.command('place', { what: t, where: { x: 0, y: 0, world: { x: 0, y: CATALOG[t].y ?? 0, z: 0.5 }, surface: CATALOG[t].mount === 'wall' ? 'wall' : 'floor' } })}>
              {CATALOG[t].label}
            </button>
          ))}
        </div>
        <div className="hx-menu">
          <button className="hx-btn hx-btn--danger" onClick={() => rt.command('reset', {})}>
            Start over
          </button>
        </div>
        <h2>Nudge selected</h2>
        <div className="hx-menu" role="group" aria-label="Move the selected item">
          <button className="hx-btn" aria-label="Move left" onClick={() => nudge(-step, 0)(rt)}>←</button>
          <button className="hx-btn" aria-label="Move back" onClick={() => nudge(0, -step)(rt)}>↑</button>
          <button className="hx-btn" aria-label="Move forward" onClick={() => nudge(0, step)(rt)}>↓</button>
          <button className="hx-btn" aria-label="Move right" onClick={() => nudge(step, 0)(rt)}>→</button>
          <button className="hx-btn hx-btn--ghost" onClick={() => rt.command('lights', { on: !rt.state.doc.app.lightsOn })}>💡 Lights</button>
        </div>
      </nav>
    )}
    right={() => <SceneList title="Scene" />}
  />,
);
