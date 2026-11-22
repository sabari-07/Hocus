import '@fontsource/cinzel/600.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/jetbrains-mono/400.css';
import './styles/hocus.css';

export { HocusApp, type HocusAppProps } from './components/HocusApp.tsx';
export { SceneList } from './components/SceneList.tsx';
export { type AppLink } from './components/Landing.tsx';
export { HocusRuntime, DEFAULT_SETTINGS, type SceneController, type JudgeStep, type Settings, type UiState } from './runtime.ts';
export { useRuntime, useUi, useCore } from './hooks.ts';
export { t, setUiLang } from './i18n/index.ts';

/** Links between the apps; URLs can be overridden at build time for deployment. */
export function appLinks(): import('./components/Landing.tsx').AppLink[] {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  return [
    { id: 'room-designer', title: 'Haunted Room Designer', blurb: 'Decorate a 3D haunted room by pointing and talking.', href: env.VITE_ROOM_URL ?? 'http://localhost:5281/' },
    { id: 'planet-explorer', title: 'Point & Ask Planet Explorer', blurb: 'A touchless 3D solar system with a quiz.', href: env.VITE_PLANETS_URL ?? 'http://localhost:5282/' },
    { id: 'kitchen-board', title: 'Recipe Board', blurb: 'Hands-free recipe cards (built from one spec).', href: env.VITE_KITCHEN_URL ?? 'http://localhost:5283/' },
  ];
}
