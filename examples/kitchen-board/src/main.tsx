import { createRoot } from 'react-dom/client';
import { HocusApp, appLinks, type JudgeStep } from '@hocus/ui';
import { kitchenApp } from './app.ts';
import { createKitchenScene } from './scene.ts';

const JUDGE: JudgeStep[] = [
  { point: 'pumpkin', say: 'double this', caption: 'Messy hands? Point at the purée and say “double this”.' },
  { point: 'step-3', say: 'start a timer for that', caption: 'Timers by pointing.' },
  { point: 'step-1', say: 'mark this done', caption: 'Tick steps off.' },
  { say: 'next', caption: 'Same skeleton, third app, under 150 lines. Your turn!' },
];

createRoot(document.getElementById('root')!).render(
  <HocusApp
    app={kitchenApp}
    theme="board"
    rightLabel="Cards"
    stage={{ label: 'A 3D recipe board with ingredient and step cards', cameraPosition: [0, 0.4, 11], lookAt: [0, 0.5, 0], fov: 48, bloom: false }}
    createScene={createKitchenScene}
    judge={JUDGE}
    links={appLinks()}
  />,
);
