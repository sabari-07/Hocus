import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AppDefinition, CoreState, FusionConfig } from '@hocus/core';
import { testSnippet, XRay } from '@hocus/devtools';
import { Stage, type StageOptions } from '@hocus/three';
import { RuntimeContext, useCore, useUi } from '../hooks.ts';
import { t } from '../i18n/index.ts';
import { HocusRuntime, type JudgeStep, type SceneController } from '../runtime.ts';
import { SettingsDrawer, Spellbook } from './Drawers.tsx';
import { Landing, type AppLink } from './Landing.tsx';
import { Onboarding } from './Onboarding.tsx';
import { CornerCalibration } from './Calibration.tsx';
import { CameraPreview, JudgeCaption, LassoTrail, LiveRegions, Loading, Toasts, Wisp } from './Overlays.tsx';
import { SceneList } from './SceneList.tsx';
import { SpeechBar } from './SpeechBar.tsx';

export interface HocusAppProps<S> {
  app: AppDefinition<S>;
  stage: Omit<StageOptions, 'reducedMotion'>;
  createScene: (stage: Stage, rt: HocusRuntime<S>) => SceneController<S>;
  /** Left panel (e.g. the Crypt palette). */
  left?: (rt: HocusRuntime<S>, state: CoreState<S>) => ReactNode;
  /** Right panel (defaults to the scene list). */
  right?: (rt: HocusRuntime<S>, state: CoreState<S>) => ReactNode;
  topExtra?: (rt: HocusRuntime<S>) => ReactNode;
  judge: JudgeStep[];
  links: AppLink[];
  config?: Partial<FusionConfig>;
}

/** The shared Hocus shell. An app provides its definition, its 3D scene and optional side panels. */
export function HocusApp<S>(props: HocusAppProps<S>) {
  const [rt] = useState(() => new HocusRuntime(props.app, props.config ? { config: props.config } : {}));
  useEffect(() => {
    // Test hook for Playwright (dev builds or ?e2e only).
    const env = (import.meta as unknown as { env?: { DEV?: boolean } }).env;
    if (env?.DEV || location.search.includes('e2e')) (window as unknown as { __hocus: unknown }).__hocus = rt;
    return () => rt.detach();
  }, [rt]);
  return (
    <RuntimeContext.Provider value={rt}>
      <Shell {...props} rt={rt} />
    </RuntimeContext.Provider>
  );
}

function Shell<S>(props: HocusAppProps<S> & { rt: HocusRuntime<S> }) {
  const { rt } = props;
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const core = useCore<S>();
  const settings = useUi((s) => s.settings);
  const xray = useUi((s) => s.xray);
  const vision = useUi((s) => s.vision);
  const speech = useUi((s) => s.speech);
  const selected = useUi((s) => s.selectedDecision);
  const [panel, setPanel] = useState<'left' | 'right' | null>(null);

  // Stage + scene lifecycle.
  useEffect(() => {
    if (!host.current) return;
    const stage = new Stage(host.current, { ...props.stage, reducedMotion: settings.reducedMotion });
    const scene = props.createScene(stage, rt);
    rt.attachStage(stage, scene);
    stage.start();
    setReady(true);
    return () => {
      stage.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme attributes.
  useEffect(() => {
    const d = document.documentElement;
    d.dataset.theme = settings.highContrast ? 'contrast' : 'default';
    d.dataset.large = String(settings.largeTargets);
    d.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
    d.lang = settings.lang;
  }, [settings.highContrast, settings.largeTargets, settings.reducedMotion, settings.lang]);

  // Keyboard map (a11y.md).
  useEffect(() => {
    const inField = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      const typing = inField(e);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (typing) return;
        e.preventDefault();
        rt.key(e.shiftKey ? 'redo' : 'undo');
        return;
      }
      if (e.key === 'Escape') {
        rt.key('cancel');
        if (rt.ui.getState().judge) rt.stopJudge();
        return;
      }
      if (typing) return;
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        rt.pushToTalk(true);
      } else if (e.key === 'Enter' && (rt.state.phase.kind === 'preview' || rt.state.phase.kind === 'confirm')) {
        e.preventDefault();
        rt.key('confirm');
      } else if (/^[1-9]$/.test(e.key) && rt.state.phase.kind === 'ask') rt.key('choose', Number(e.key) - 1);
      else if (e.key === '?') rt.ui.setState({ spellbook: true });
      else if (e.key.toLowerCase() === 'x' && !e.ctrlKey && !e.metaKey) rt.ui.setState((s) => ({ xray: !s.xray }));
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !inField(e)) rt.pushToTalk(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [rt]);

  // Kiosk mode (?kiosk=1): large targets, auto-reset after 2 minutes idle, attract via Judge Mode.
  useEffect(() => {
    if (!new URLSearchParams(location.search).has('kiosk')) return;
    rt.updateSettings({ largeTargets: true });
    let last = performance.now();
    const bump = () => (last = performance.now());
    window.addEventListener('pointermove', bump);
    window.addEventListener('keydown', bump);
    const id = setInterval(() => {
      if (performance.now() - last > 120_000 && !rt.ui.getState().judge) {
        while (rt.state.past.length) rt.key('undo');
        rt.ui.setState({ landing: false });
        last = performance.now();
        void rt.playJudge(props.judge);
      }
    }, 5000);
    return () => {
      clearInterval(id);
      window.removeEventListener('pointermove', bump);
      window.removeEventListener('keydown', bump);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt]);

  const exportReplay = () => {
    const blob = new Blob([JSON.stringify(rt.exportReplay(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${rt.app.id}-${new Date().toISOString().replace(/[:.]/g, '-')}.replay.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const online = typeof navigator === 'undefined' || navigator.onLine;

  return (
    <div className="hx-app">
      <header className="hx-top">
        <p className="hx-logo" aria-hidden="true">
          Hocus
        </p>
        <h1 className="hx-appname">{props.app.title}</h1>
        <div className="hx-top__spacer" />
        <span className="hx-status" data-on={vision === 'running'} title={t('cameraOn')}>
          <span className="hx-status__dot" /> 📷 {vision === 'running' ? `${rt.vision.fps} fps` : vision === 'loading' ? t('modelLoading') : t('cameraOff')}
        </span>
        <span className="hx-status" data-on={speech === 'listening'}>
          <span className="hx-status__dot" /> 🎙 {speech}
        </span>
        <span className="hx-status">{settings.lang.toUpperCase()}</span>
        {!online && <span className="hx-status">{t('offline')}</span>}
        {props.topExtra?.(rt)}
        <button className="hx-btn hx-btn--ghost hx-toggle" aria-pressed={xray} onClick={() => rt.ui.setState({ xray: !xray })}>
          🩻 {t('xray')}
        </button>
        <button className="hx-btn hx-btn--ghost" onClick={() => void rt.playJudge(props.judge)}>
          ▶ {t('judgeMode')}
        </button>
        <button className="hx-btn hx-btn--ghost" onClick={() => rt.ui.setState({ spellbook: true })} aria-keyshortcuts="?">
          📖 {t('spellbook')}
        </button>
        <button className="hx-btn hx-btn--ghost hx-iconbtn" aria-label={t('settings')} onClick={() => rt.ui.setState({ settingsOpen: true })}>
          ⚙
        </button>
        <button className="hx-btn hx-btn--ghost hx-iconbtn hx-panel-toggle" aria-label="Toggle side panel" onClick={() => setPanel(panel ? null : 'right')}>
          ☰
        </button>
      </header>
      <main className="hx-main">
        {props.left ? (
          <aside className="hx-side hx-side--left" data-open={panel === 'left'}>
            {props.left(rt, core)}
          </aside>
        ) : (
          <div />
        )}
        <div className="hx-stagewrap" ref={host} data-cursor={settings.inputMode === 'mouse' ? 'none' : 'none'}>
          <Loading show={!ready} />
          <CameraPreview />
          <JudgeCaption />
          {xray && (
            <div className="hx-xraywrap">
              <XRay
                engine={rt.engine}
                decisions={core.decisions}
                selected={selected}
                onSelect={(seq) => rt.ui.setState({ selectedDecision: seq })}
                onExport={exportReplay}
                onCopyTest={(rec) => {
                  void navigator.clipboard?.writeText(testSnippet(`../../${rt.app.id === 'kitchen-board' ? 'examples' : 'apps'}/${rt.app.id}/src/app.ts`, `./${rt.app.id}-session.replay.json`));
                  rt.toast(t('copied'));
                }}
                onLoadReplay={(json) => rt.loadReplay(json)}
                eventCount={rt.log.length}
                labels={{
                  title: t('decisionWhy'),
                  pointed: t('pointed'),
                  words: t('words'),
                  decision: t('decision'),
                  empty: t('noDecision'),
                  exportReplay: t('exportReplay'),
                  copyTest: t('copyTest'),
                  simulator: t('simulator'),
                  recorder: t('recorder'),
                }}
              />
            </div>
          )}
          <Landing apps={props.links} onDemo={() => void rt.playJudge(props.judge)} />
        </div>
        <aside className="hx-side" data-open={panel === 'right'}>
          {props.right ? props.right(rt, core) : <SceneList />}
        </aside>
      </main>
      <SpeechBar />
      <Wisp />
      <LassoTrail />
      <Toasts />
      <LiveRegions />
      <Spellbook />
      <SettingsDrawer />
      <Onboarding />
      <CornerCalibration />
    </div>
  );
}
