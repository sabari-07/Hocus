import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useRef, useState } from 'react';
import { LANGS, PACKS } from '@hocus/core';
import { useRuntime, useUi } from '../hooks.ts';
import { t } from '../i18n/index.ts';

/**
 * About 30 seconds, skippable: language, permissions, point at the ghost, say "this" (measures the
 * recognizer lag from our own voice-activity onset), then try a command.
 */
export function Onboarding() {
  const rt = useRuntime();
  const open = useUi((s) => s.onboarding);
  const pointer = useUi((s) => s.pointer);
  const speech = useUi((s) => s.speech);
  const interim = useUi((s) => s.interim);
  const [step, setStep] = useState(0);
  const [measured, setMeasured] = useState<number | null>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const firstSeen = useRef<number | null>(null);

  const over = (() => {
    const g = ghost.current?.getBoundingClientRect();
    if (!g || !pointer?.active) return false;
    return pointer.x >= g.left - 12 && pointer.x <= g.right + 12 && pointer.y >= g.top - 12 && pointer.y <= g.bottom + 12;
  })();

  // Step 3: when "this" first shows up in an interim, lag = interim time - VAD speech onset.
  useEffect(() => {
    if (step !== 3 || measured != null) return;
    const words = PACKS[rt.state.lang].deictics.map((d) => d.phrase);
    if (interim && words.some((w) => interim.toLowerCase().includes(w)) && firstSeen.current == null) {
      firstSeen.current = performance.now();
      const onset = rt.recognizer.lastOnset();
      if (onset != null) {
        const lag = Math.round(Math.min(1200, Math.max(100, firstSeen.current - onset)));
        setMeasured(lag);
        rt.updateSettings({ lagMs: lag });
      }
    }
  }, [interim, step, measured, rt]);

  const close = () => {
    rt.ui.setState({ onboarding: false });
    rt.updateSettings({ onboarded: true });
    setStep(0);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="hx-overlay" />
        <Dialog.Content className="hx-dialog" aria-describedby="hx-onboard-desc">
          <Dialog.Title asChild>
            <h2>{t('onboardWelcome')}</h2>
          </Dialog.Title>
          <div id="hx-onboard-desc" className="hx-stack">
            {step === 0 && (
              <div className="hx-row" role="group" aria-label={t('language')}>
                {LANGS.map((l) => (
                  <button key={l} className="hx-btn hx-btn--big" aria-pressed={rt.state.lang === l} onClick={() => { rt.updateSettings({ lang: l }); setStep(1); }}>
                    {PACKS[l].name}
                  </button>
                ))}
              </div>
            )}
            {step === 1 && (
              <>
                <p>{t('onboardPerms')}</p>
                <div className="hx-row">
                  <button className="hx-btn hx-btn--primary hx-btn--big" onClick={() => { void rt.startCamera(); setStep(2); }}>
                    {t('allowCamera')}
                  </button>
                  <button className="hx-btn hx-btn--ghost" onClick={() => setStep(2)}>
                    {t('useMouse')}
                  </button>
                </div>
              </>
            )}
            {(step === 2 || step === 3) && (
              <>
                <p aria-live="polite">{step === 2 ? t('onboardPoint') : t('onboardSay')}</p>
                <div ref={ghost} className="hx-onboard-ghost" data-locked={over} aria-label="Ghost target" role="img">
                  👻
                </div>
                {step === 3 && (
                  <p className="hx-small hx-muted">
                    {speech === 'listening' ? `“${interim}”` : ''} {measured != null ? t('measured', { ms: measured }) : ''}
                  </p>
                )}
                <div className="hx-row">
                  {step === 2 && (
                    <button className="hx-btn" onClick={() => setStep(3)} disabled={!over && pointer?.active}>
                      {t('next')}
                    </button>
                  )}
                  {step === 3 && (
                    <>
                      <button className="hx-btn" onPointerDown={() => rt.pushToTalk(true)} onPointerUp={() => rt.pushToTalk(false)}>
                        🎙 {t('mic')}
                      </button>
                      <button className="hx-btn" onClick={() => setStep(4)}>
                        {t('next')}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
            {step === 4 && (
              <>
                <p>{t('onboardTry')}</p>
                <p>{t('onboardDone')}</p>
                <button className="hx-btn hx-btn--primary" onClick={close}>
                  {t('next')}
                </button>
              </>
            )}
          </div>
          <button className="hx-btn hx-btn--ghost" onClick={close}>
            {t('skip')}
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
