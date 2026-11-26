import { useEffect, useState } from 'react';
import type { Binding, Resolution, WordResolution } from '@hocus/core';
import { useCore, useRuntime, useUi } from '../hooks.ts';
import { t } from '../i18n/index.ts';

const threadOf = (b?: Binding): string | undefined =>
  b?.kind === 'object' ? b.id : b?.kind === 'place' && b.world ? `place:${b.world.x},${b.world.y},${b.world.z}` : undefined;

/**
 * The speech dock: a floating mic orb, the transcript with word chips (each chip threads into the scene),
 * a ghost preview of what Hocus would do while you are still speaking or typing, the preview countdown,
 * numbered ask options, the typed box and undo/redo.
 */
export function SpeechBar() {
  const rt = useRuntime();
  const core = useCore();
  const interim = useUi((s) => s.interim);
  const speech = useUi((s) => s.speech);
  const draft = useUi((s) => s.draft);
  const live = useUi((s) => s.live);
  const [now, setNow] = useState(() => performance.now());
  const phase = core.phase;
  const last = core.decisions[core.decisions.length - 1];
  const listening = speech === 'listening';

  useEffect(() => {
    if (phase.kind !== 'preview' && phase.kind !== 'confirm') return;
    let raf = 0;
    const loop = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [phase.kind]);

  const label = (id: string) => rt.engine.labelOf(core, id);
  /** How sure Hocus is: the winner's share of all evidence for that word (0..1). */
  const sureOf = (w: WordResolution) => {
    const total = w.candidates.reduce((a, c) => a + c.evidence, 0);
    return w.binding && total > 0 && w.candidates[0] ? Math.min(1, w.candidates[0].evidence / total) : 0;
  };
  const chipText = (w: WordResolution) => {
    const b = w.binding;
    if (b?.kind === 'object') return label(b.id);
    if (b?.kind === 'objects') return b.ids.map(label).join(', ');
    if (b?.kind === 'place') return t('herePlace');
    if (b?.kind === 'quantity') return `${Math.round(b.value * 100)}%`;
    return w.candidates.length ? '?' : '…';
  };

  // Which resolution to show: the live ghost while composing, otherwise the latest decision.
  const composing = !!(listening || interim || draft) && phase.kind !== 'preview' && phase.kind !== 'confirm' && phase.kind !== 'ask';
  const res: Resolution | undefined = composing ? (live?.preview.kind === 'frame' ? live.preview.resolution : undefined) : last?.resolution;
  const words = (res?.words ?? []).filter((w) => w.role !== 'literal');
  const kind = composing ? 'live' : phase.kind === 'ask' ? 'ask' : 'bound';
  const sentence = composing
    ? live?.preview.kind === 'frame'
      ? live.preview.sentence ?? (live.preview.resolution.status === 'ask' ? t('wouldAsk') : live.preview.resolution.status === 'no_target' ? t('pointFirstShort') : '')
      : live?.preview.kind === 'control'
        ? `${live.preview.intent}`
        : ''
    : phase.kind === 'preview' || phase.kind === 'confirm'
      ? phase.pending.sentence
      : '';

  const total = phase.kind === 'preview' ? core.config.previewMs : phase.kind === 'confirm' ? core.config.confirmTimeoutMs : 1;
  const remaining = phase.kind === 'preview' || phase.kind === 'confirm' ? Math.max(0, phase.until - Math.max(now, core.t)) : 0;
  const frac = Math.min(1, remaining / total);
  const quote = listening || interim ? interim || '…' : composing ? draft : last?.raw;

  return (
    <footer className="hx-dock" aria-label="Speech bar" data-state={listening ? 'listening' : phase.kind}>
      <button
        className="hx-orb"
        data-active={listening}
        aria-label={t('mic')}
        aria-pressed={listening}
        disabled={speech === 'unsupported'}
        onPointerDown={() => rt.pushToTalk(true)}
        onPointerUp={() => rt.pushToTalk(false)}
        onPointerLeave={() => listening && rt.pushToTalk(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') rt.pushToTalk(!listening);
        }}
      >
        <span className="hx-orb__core" aria-hidden="true" />
        <span className="hx-orb__ring" aria-hidden="true" />
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
        </svg>
      </button>

      <div className="hx-transcript">
        <div className="hx-transcript__line" aria-live="off">
          {quote ? <span className="hx-quote">“{quote}”</span> : <span className="hx-muted">{speech === 'unsupported' ? t('speechUnsupported') : t('holdSpace')}</span>}
          {words.map((w, i) => (
            <span
              key={`${w.slot}-${i}`}
              className={`hx-word hx-word--${w.binding ? (composing ? 'live' : 'resolved') : res?.status === 'ask' ? 'asking' : 'unresolved'}`}
              data-thread={threadOf(w.binding)}
              data-thread-kind={kind}
            >
              <b>{w.word}</b> → {chipText(w)}
              {sureOf(w) > 0 && <i className="hx-sure" style={{ width: `${Math.round(sureOf(w) * 100)}%` }} title={`${Math.round(sureOf(w) * 100)}% of the evidence`} />}
            </span>
          ))}
        </div>
        {sentence && (
          <div className={`hx-transcript__status${composing ? ' hx-ghost' : ''}`}>
            {composing ? '✧ ' : ''}
            {sentence}
          </div>
        )}
      </div>

      {(phase.kind === 'preview' || phase.kind === 'confirm') && (
        <div className="hx-row" role="group" aria-label="Pending command">
          <svg className="hx-countdown" viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r="15" stroke="rgba(255,255,255,.15)" />
            <circle cx="18" cy="18" r="15" stroke={phase.kind === 'confirm' ? '#FF5D73' : '#4FE3C1'} strokeDasharray={`${frac * 94.2} 94.2`} />
          </svg>
          <button className="hx-btn hx-btn--ghost" onClick={() => rt.key('cancel')}>
            {t('cancel')} <span className="hx-kbd">Esc</span>
          </button>
          <button className={phase.kind === 'confirm' ? 'hx-btn hx-btn--danger' : 'hx-btn'} onClick={() => rt.key('confirm')}>
            {phase.kind === 'confirm' ? t('confirm') : t('run')} <span className="hx-kbd">Enter</span>
          </button>
        </div>
      )}

      {phase.kind === 'ask' && (
        <div className="hx-ask" role="group" aria-label="Which one did you mean?">
          {phase.options.map((o, i) => (
            <button key={o.id} className="hx-btn" onClick={() => rt.key('choose', i)} data-thread={o.id} data-thread-kind="ask">
              <span className="hx-kbd">{i + 1}</span> {label(o.id)}
            </button>
          ))}
          <button className="hx-btn hx-btn--ghost" onClick={() => rt.key('cancel')}>
            {t('cancel')}
          </button>
        </div>
      )}

      <form
        className="hx-typed"
        onSubmit={(e) => {
          e.preventDefault();
          rt.typed(draft);
        }}
      >
        <label className="hx-visually-hidden" htmlFor="hx-typed">
          {t('typeCommand')}
        </label>
        <input
          id="hx-typed"
          className="hx-input"
          value={draft}
          placeholder={t('typeCommand')}
          onChange={(e) => rt.ui.setState({ draft: e.target.value })}
          autoComplete="off"
          onFocus={() => rt.hub && (rt.hub.paused = true)}
          onBlur={() => rt.hub && (rt.hub.paused = false)}
        />
        <button className="hx-btn" type="submit">
          {t('send')}
        </button>
      </form>
      <div className="hx-row">
        <button className="hx-btn hx-btn--ghost hx-iconbtn" aria-label={`${t('undo')} (Ctrl+Z)`} onClick={() => rt.key('undo')} disabled={!core.past.length}>
          ↶
        </button>
        <button className="hx-btn hx-btn--ghost hx-iconbtn" aria-label={`${t('redo')} (Ctrl+Shift+Z)`} onClick={() => rt.key('redo')} disabled={!core.future.length}>
          ↷
        </button>
      </div>
    </footer>
  );
}
