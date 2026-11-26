import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AppDefinition, CoreState, FusionConfig } from '@hocus/core';
import { testSnippet, XRay } from '@hocus/devtools';
import { Stage, type StageOptions } from '@hocus/three';
import { RuntimeContext, useCore, useUi } from '../hooks.ts';
import { t } from '../i18n/index.ts';
import { HocusRuntime, type JudgeStep, type SceneController } from '../runtime.ts';
import { CornerCalibration } from './Calibration.tsx';
import { SettingsDrawer, Spellbook } from './Drawers.tsx';
import { Hud } from './Hud.tsx';
import { Landing, type AppLink } from './Landing.tsx';
import { Onboarding } from './Onboarding.tsx';
import { CameraPreview, Echoes, JudgeCaption, LassoTrail, LiveRegions, Loading, Toasts, Wisp } from './Overlays.tsx';
import { SceneList } from './SceneList.tsx';
import { SpeechBar } from './SpeechBar.tsx';
import { SpellThreads } from './SpellThreads.tsx';

export interface HocusAppProps<S> {
  app: AppDefinition<S>;
  stage: Omit<StageOptions, 'reducedMotion'>;
  createScene: (stage: Stage, rt: HocusRuntime<S>) => SceneController<S>;
  /** Left floating panel (e.g. the Crypt palette). Omit for none. */
  left?: (rt: HocusRuntime<S>, state: CoreState<S>) => ReactNode;
  /** Right floating panel (defaults to the scene list). */
  right?: (rt: HocusRuntime<S>, state: CoreState<S>) => ReactNode;
  leftLabel?: string;
  rightLabel?: string;
  /** Visual identity: `candle` (amber, default), `observatory` (teal) or `board` (cream). */
  theme?: 'candle' | 'observatory' | 'board';
  /** Extra toolbar buttons (use `.hx-tool`). */
  topExtra?: (rt: HocusRuntime<S>) => ReactNode;
  judge: JudgeStep[];
  links: AppLink[];
  config?: Partial<FusionConfig>;
}

const THEME_ATTR = { candle: 'candle', observatory: 'observatory', board: 'board' } as const;

/** The shared Hocus shell. An app provides its definition, its 3D scene and optional floating panels. */
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
  const [gpuLost, setGpuLost] = useState(false);
  const core = useCore<S>();
  const settings = useUi((s) => s.settings);
  const xray = useUi((s) => s.xray);
  const vision = useUi((s) => s.vision);
  const panels = useUi((s) => s.panels);
  const selected = useUi((s) => s.selectedDecision);

  // Stage + scene lifecycle.
  useEffect(() => {
    if (!host.current) return;
    const stage = new Stage(host.current, { ...props.stage, reducedMotion: settings.reducedMotion });
    const scene = props.createScene(stage, rt);
    rt.attachStage(stage, scene);
    stage.start();
    setReady(true);
    const offLoss = stage.onContextLoss(setGpuLost);
    return () => {
      offLoss();
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

  // Kiosk mode (?kiosk=1): large targets, auto-reset after 2 minutes idle, then Judge Mode as an attract loop.
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

  const rightLabel = props.rightLabel ?? t('sceneList');
  const leftLabel = props.leftLabel ?? 'Palette';

  return (
    <div className="hx-app" data-app={THEME_ATTR[props.theme ?? 'candle']} data-cam={vision === 'running'}>
      <div className="hx-stagewrap" ref={host}>
        <Loading show={!ready} />
        <JudgeCaption />
        {gpuLost && (
          <div className="hx-banner hx-glass" role="alert">
            <span>{t('gpuLost')}</span>
            <button className="hx-btn" onClick={() => location.reload()}>
              {t('reload')}
            </button>
          </div>
        )}
        <Landing apps={props.links} onDemo={() => void rt.playJudge(props.judge)} />
      </div>

      <Hud title={props.app.title} extra={props.topExtra?.(rt)} onJudge={() => void rt.playJudge(props.judge)} leftLabel={leftLabel} rightLabel={rightLabel} hasLeft={!!props.left} />
      <Echoes />
      <CameraPreview />

      {props.left && (
        <aside className="hx-float hx-float--left hx-glass" data-open={panels.left} inert={!panels.left} aria-label={leftLabel}>
          {props.left(rt, core)}
        </aside>
      )}
      <aside className="hx-float hx-float--right hx-glass" data-open={panels.right} inert={!panels.right} aria-label={rightLabel}>
        {props.right ? props.right(rt, core) : <SceneList />}
      </aside>

      {xray && (
        <div className="hx-xraywrap">
          <XRay
            engine={rt.engine}
            decisions={core.decisions}
            selected={selected}
            onSelect={(seq) => rt.ui.setState({ selectedDecision: seq })}
            onExport={exportReplay}
            onCopyTest={() => {
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

      <SpeechBar />
      <SpellThreads />
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
