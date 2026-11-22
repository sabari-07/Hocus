import { useEffect, useRef, useState } from 'react';
import type { WordResolution } from '@hocus/core';
import { useCore, useRuntime, useUi } from '../hooks.ts';
import { t } from '../i18n/index.ts';

/** Bottom bar: push-to-talk, transcript with word chips, preview countdown, ask options, typed box, undo. */
export function SpeechBar() {
  const rt = useRuntime();
  const core = useCore();
  const interim = useUi((s) => s.interim);
  const speech = useUi((s) => s.speech);
  const [text, setText] = useState('');
  const [now, setNow] = useState(() => performance.now());
  const input = useRef<HTMLInputElement>(null);
  const phase = core.phase;
  const last = core.decisions[core.decisions.length - 1];

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

  const listening = speech === 'listening';
  const status =
    speech === 'unsupported'
      ? t('speechUnsupported')
      : listening
        ? t('listening')
        : phase.kind === 'preview'
          ? phase.pending.sentence
          : phase.kind === 'confirm'
            ? `${phase.pending.sentence}?`
            : t('holdSpace');

  const label = (id: string) => rt.engine.labelOf(core, id);
  const words = (last?.resolution.words ?? []).filter((w) => w.role !== 'literal');
  const chipText = (w: WordResolution) => {
    const b = w.binding;
    if (b?.kind === 'object') return `${w.word} → ${label(b.id)}`;
    if (b?.kind === 'objects') return `${w.word} → ${b.ids.map(label).join(', ')}`;
    if (b?.kind === 'place') return `${w.word} → 📍`;
    if (b?.kind === 'quantity') return `${w.word} → ${Math.round(b.value * 100)}%`;
    return `${w.word} → ?`;
  };
  const chipClass = (w: WordResolution) =>
    w.binding ? 'hx-word hx-word--resolved' : last?.resolution.status === 'ask' ? 'hx-word hx-word--asking' : 'hx-word hx-word--unresolved';

  const total = phase.kind === 'preview' ? core.config.previewMs : phase.kind === 'confirm' ? core.config.confirmTimeoutMs : 1;
  const remaining = phase.kind === 'preview' || phase.kind === 'confirm' ? Math.max(0, phase.until - Math.max(now, core.t)) : 0;
  const frac = Math.min(1, remaining / total);

  return (
    <footer className="hx-bar" aria-label="Speech bar">
      <button
        className="hx-mic"
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
        🎙
      </button>
      <div className="hx-transcript">
        <div className="hx-transcript__line" aria-live="off">
          {listening || interim ? (
            <span>“{interim || '…'}”</span>
          ) : last ? (
            <>
              <span>“{last.raw}”</span>
              {words.map((w, i) => (
                <span key={i} className={chipClass(w)}>
                  {chipText(w)}
                </span>
              ))}
            </>
          ) : null}
        </div>
        <div className="hx-transcript__status">{status}</div>
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
            <button key={o.id} className="hx-btn" onClick={() => rt.key('choose', i)}>
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
          rt.typed(text);
          setText('');
        }}
      >
        <label className="hx-visually-hidden" htmlFor="hx-typed">
          {t('typeCommand')}
        </label>
        <input id="hx-typed" ref={input} className="hx-input" value={text} placeholder={t('typeCommand')} onChange={(e) => setText(e.target.value)} autoComplete="off" />
        <button className="hx-btn" type="submit">
          {t('send')}
        </button>
      </form>
      <button className="hx-btn hx-btn--ghost hx-iconbtn" aria-label={`${t('undo')} (Ctrl+Z)`} onClick={() => rt.key('undo')} disabled={!core.past.length}>
        ↶
      </button>
      <button className="hx-btn hx-btn--ghost hx-iconbtn" aria-label={`${t('redo')} (Ctrl+Shift+Z)`} onClick={() => rt.key('redo')} disabled={!core.future.length}>
        ↷
      </button>
    </footer>
  );
}
