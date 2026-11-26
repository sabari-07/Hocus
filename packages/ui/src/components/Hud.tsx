import type { ReactNode } from 'react';
import { useRuntime, useUi } from '../hooks.ts';
import { t } from '../i18n/index.ts';
import { Icon } from './Icons.tsx';

/** Top HUD: brand, live input status, and the toolbar. Floats over the 3D world; there is no header bar. */
export function Hud({
  title,
  extra,
  onJudge,
  leftLabel,
  rightLabel,
  hasLeft,
}: {
  title: string;
  extra?: ReactNode;
  onJudge: () => void;
  leftLabel: string;
  rightLabel: string;
  hasLeft: boolean;
}) {
  const rt = useRuntime();
  const vision = useUi((s) => s.vision);
  const speech = useUi((s) => s.speech);
  const xray = useUi((s) => s.xray);
  const panels = useUi((s) => s.panels);
  const lang = useUi((s) => s.settings.lang);
  const privacy = useUi((s) => s.privacy);
  const online = typeof navigator === 'undefined' || navigator.onLine;
  const setPanel = (k: 'left' | 'right') => rt.ui.setState((s) => ({ panels: { ...s.panels, [k]: !s.panels[k] } }));

  return (
    <header className="hx-hud">
      <div className="hx-brand hx-glass">
        <svg className="hx-brand__mark" viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="11" fill="none" stroke="#FFB347" strokeWidth="3" />
          <circle cx="16" cy="16" r="3.2" fill="#4FE3C1" />
          <path d="M16 2v5M16 25v5M2 16h5M25 16h5" stroke="#FFB347" strokeWidth="2" strokeLinecap="round" opacity=".6" />
        </svg>
        <div className="hx-brand__text">
          <p className="hx-brand__name" aria-hidden="true">
            Hocus
          </p>
          <h1 className="hx-brand__app">{title}</h1>
        </div>
      </div>

      <div className="hx-chips hx-glass" aria-label="Input status">
        <span className="hx-status" data-on={vision === 'running'} title={t('cameraOn')}>
          <span className="hx-status__dot" />
          <Icon name="camera" size={15} />
          {vision === 'running' ? `${rt.vision.fps} fps` : vision === 'loading' ? t('modelLoading') : t('cameraOff')}
        </span>
        <span className="hx-status" data-on={speech === 'listening'} title={privacy === 'on-device' ? t('speechLocal') : t('speechCloud')}>
          <span className="hx-status__dot" />
          <Icon name="mic" size={15} />
          {speech}
        </span>
        <span className="hx-status">
          <Icon name="globe" size={15} />
          {lang.toUpperCase()}
        </span>
        {!online && <span className="hx-status">{t('offline')}</span>}
      </div>

      <div className="hx-hud__spacer" />

      <nav className="hx-toolbar hx-glass" aria-label="Tools">
        {extra}
        {hasLeft && (
          <button className="hx-tool" aria-pressed={panels.left} onClick={() => setPanel('left')} title={leftLabel}>
            <Icon name="panelL" />
            <span className="hx-tool__label">{leftLabel}</span>
          </button>
        )}
        <button className="hx-tool" aria-pressed={panels.right} onClick={() => setPanel('right')} title={rightLabel}>
          <Icon name="panelR" />
          <span className="hx-tool__label">{rightLabel}</span>
        </button>
        <button className="hx-tool" aria-pressed={xray} onClick={() => rt.ui.setState({ xray: !xray })} aria-keyshortcuts="X">
          <Icon name="eye" />
          <span className="hx-tool__label">{t('xray')}</span>
        </button>
        <button className="hx-tool hx-tool--hero" onClick={onJudge}>
          <Icon name="play" />
          <span className="hx-tool__label">{t('judgeMode')}</span>
        </button>
        <button className="hx-tool" onClick={() => rt.ui.setState({ spellbook: true })} aria-keyshortcuts="?">
          <Icon name="book" />
          <span className="hx-tool__label">{t('spellbook')}</span>
        </button>
        <button className="hx-tool hx-tool--icon" aria-label={t('settings')} onClick={() => rt.ui.setState({ settingsOpen: true })}>
          <Icon name="sliders" />
        </button>
      </nav>
    </header>
  );
}
