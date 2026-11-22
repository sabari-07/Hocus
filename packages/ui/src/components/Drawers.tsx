import * as Dialog from '@radix-ui/react-dialog';
import { useMemo, useState } from 'react';
import { LANGS, PACKS, type LangCode } from '@hocus/core';
import type { InputMode } from '@hocus/input';
import { useCore, useRuntime, useUi } from '../hooks.ts';
import { t } from '../i18n/index.ts';

function Drawer({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: React.ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="hx-overlay" />
        <Dialog.Content className="hx-drawer" aria-describedby={undefined}>
          <div className="hx-row">
            <Dialog.Title asChild>
              <h2 className="hx-grow">{title}</h2>
            </Dialog.Title>
            <Dialog.Close className="hx-btn hx-btn--ghost hx-iconbtn" aria-label="Close">
              ✕
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const BASICS: Record<LangCode, Array<[string, string]>> = {
  en: [
    ['undo', 'Take back the last change'],
    ['redo', 'Put it back'],
    ['no, the other one', 'Undo and pick the runner-up'],
    ['not that', 'Undo and ask again without it'],
    ['the first one / 2', 'Answer a question'],
    ['what was that?', 'Name what you last pointed at'],
    ['call this one Boris', 'Give something a name'],
    ['yes / stop', 'Confirm or cancel'],
  ],
  hi: [
    ['वापस करो', 'पिछला बदलाव वापस'],
    ['नहीं दूसरा वाला', 'दूसरा विकल्प चुनें'],
    ['इसका नाम बोरिस रखो', 'नाम दें'],
    ['हाँ / रुको', 'पक्का या रद्द'],
  ],
  ta: [
    ['செயல்தவிர்', 'கடைசி மாற்றத்தைத் திரும்பப் பெறு'],
    ['இல்லை மற்றொன்று', 'அடுத்த விருப்பம்'],
    ['ஆம் / நிறுத்து', 'உறுதி அல்லது ரத்து'],
  ],
};

export function Spellbook() {
  const rt = useRuntime();
  const open = useUi((s) => s.spellbook);
  const core = useCore();
  const [tab, setTab] = useState<'basics' | 'app' | 'langs'>('app');
  const [q, setQ] = useState('');
  const lang = core.lang;
  const appSpells = useMemo(
    () =>
      Object.entries(rt.app.actions).flatMap(([name, spec]) =>
        (spec.examples?.[lang] ?? spec.examples?.en ?? []).map((ex) => ({ name, ex, label: spec.menuLabel ?? name })),
      ),
    [rt.app, lang],
  );
  const match = (s: string) => !q || s.toLowerCase().includes(q.toLowerCase());
  const tryIt = (ex: string) => {
    rt.ui.setState({ spellbook: false });
    // A demonstration: if nothing is selected, select the first suitable thing so "this" has a referent.
    if (!core.selection.ids.length) {
      const first = rt.engine.selectables(core)[0];
      if (first) rt.select([first.id]);
    }
    setTimeout(() => rt.typed(ex), 50);
  };
  return (
    <Drawer open={open} onOpenChange={(o) => rt.ui.setState({ spellbook: o })} title={`📖 ${t('spellbook')}`}>
      <div className="hx-tabs" role="tablist">
        {(['basics', 'app', 'langs'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className="hx-tab" onClick={() => setTab(k)}>
            {k === 'basics' ? t('basics') : k === 'app' ? t('thisApp') : t('languages')}
          </button>
        ))}
      </div>
      <label className="hx-field">
        <span>{t('search')}</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {tab === 'app' && (
        <ul className="hx-spell">
          {appSpells
            .filter((s) => match(s.ex) || match(s.label))
            .map((s) => (
              <li key={s.name + s.ex}>
                <q>{s.ex}</q>
                <button className="hx-btn" onClick={() => tryIt(s.ex)} aria-label={`${t('tryIt')}: ${s.ex}`}>
                  {t('tryIt')}
                </button>
              </li>
            ))}
        </ul>
      )}
      {tab === 'basics' && (
        <ul className="hx-spell">
          {(BASICS[lang] ?? BASICS.en)
            .filter(([a, b]) => match(a) || match(b))
            .map(([a, b]) => (
              <li key={a}>
                <q>{a}</q>
                <span className="hx-muted hx-small">{b}</span>
              </li>
            ))}
          <li>
            <span>
              <span className="hx-kbd">Space</span> talk · <span className="hx-kbd">Enter</span> confirm · <span className="hx-kbd">Esc</span> cancel ·{' '}
              <span className="hx-kbd">1-9</span> answer · <span className="hx-kbd">Ctrl+Z</span> undo · <span className="hx-kbd">X</span> X-ray ·{' '}
              <span className="hx-kbd">?</span> Spellbook
            </span>
          </li>
          <li>
            <span className="hx-small">Shift-drag with the mouse, or draw a loop in the air, to select several things. Then say “delete these”.</span>
          </li>
        </ul>
      )}
      {tab === 'langs' && (
        <ul className="hx-spell">
          {LANGS.map((l) => (
            <li key={l}>
              <span>
                <b>{PACKS[l].name}</b>{' '}
                <span className="hx-muted hx-small">
                  {PACKS[l].deictics
                    .slice(0, 4)
                    .map((d) => d.phrase)
                    .join(', ')}
                </span>
              </span>
              <button className="hx-btn" aria-pressed={lang === l} onClick={() => rt.updateSettings({ lang: l })}>
                {PACKS[l].name}
              </button>
            </li>
          ))}
          <li className="hx-small hx-muted">Hindi and Tamil word lists were drafted with AI help and are pending native-speaker review.</li>
        </ul>
      )}
    </Drawer>
  );
}

export function SettingsDrawer() {
  const rt = useRuntime();
  const open = useUi((s) => s.settingsOpen);
  const st = useUi((s) => s.settings);
  const privacy = useUi((s) => s.privacy);
  const vision = useUi((s) => s.vision);
  const set = rt.updateSettings.bind(rt);
  const modes: InputMode[] = ['auto', 'hand', 'head', 'mouse', 'touch'];
  const modeLabel = { auto: t('inputAuto'), hand: t('inputHand'), head: t('inputHead'), mouse: t('inputMouse'), touch: t('inputTouch') };
  const check = (key: 'voiceFeedback' | 'sounds' | 'reducedMotion' | 'highContrast' | 'largeTargets' | 'alwaysListening' | 'proposer' | 'headPointer', label: string) => (
    <label className="hx-check">
      <input type="checkbox" checked={st[key]} onChange={(e) => set({ [key]: e.target.checked })} />
      {label}
    </label>
  );
  return (
    <Drawer open={open} onOpenChange={(o) => rt.ui.setState({ settingsOpen: o })} title={`⚙ ${t('settings')}`}>
      <fieldset className="hx-stack" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="hx-muted">{t('pointer')}</legend>
        <div className="hx-seg" role="group" aria-label={t('pointer')}>
          {modes.map((m) => (
            <button key={m} aria-pressed={st.inputMode === m} onClick={() => set({ inputMode: m })}>
              {modeLabel[m]}
            </button>
          ))}
        </div>
        <div className="hx-row">
          {vision === 'running' ? (
            <button className="hx-btn hx-btn--ghost" onClick={() => rt.stopCamera()}>
              {t('cameraOff')}
            </button>
          ) : (
            <button className="hx-btn" onClick={() => void rt.startCamera()}>
              {t('startCamera')}
            </button>
          )}
          {check('headPointer', t('inputHead'))}
        </div>
        <label className="hx-field">
          <span>
            {t('sensitivity')}: {Math.round(st.smoothing * 100)}%
          </span>
          <input type="range" min={0} max={1} step={0.05} value={st.smoothing} onChange={(e) => set({ smoothing: Number(e.target.value) })} />
        </label>
        <label className="hx-field">
          <span>
            {t('dwell')}: {Math.round(st.dwell * 1000)} ms
          </span>
          <input type="range" min={0.04} max={0.3} step={0.01} value={st.dwell} onChange={(e) => set({ dwell: Number(e.target.value) })} />
        </label>
        <label className="hx-field">
          <span>
            {t('lag')}: {st.lagMs} ms
          </span>
          <input type="range" min={100} max={1200} step={25} value={st.lagMs} onChange={(e) => set({ lagMs: Number(e.target.value) })} />
        </label>
        <button className="hx-btn hx-btn--ghost" onClick={() => rt.ui.setState({ settingsOpen: false, onboarding: true })}>
          {t('recalibrate')}
        </button>
      </fieldset>
      <label className="hx-field">
        <span>{t('language')}</span>
        <select value={st.lang} onChange={(e) => set({ lang: e.target.value as LangCode })}>
          {LANGS.map((l) => (
            <option key={l} value={l}>
              {PACKS[l].name}
            </option>
          ))}
        </select>
      </label>
      {check('voiceFeedback', t('voiceFeedback'))}
      {check('sounds', t('sounds'))}
      {check('alwaysListening', t('alwaysListening'))}
      {check('proposer', `${t('proposer')} (${rt.proposer.status})`)}
      {check('reducedMotion', t('reducedMotion'))}
      {check('highContrast', t('highContrast'))}
      {check('largeTargets', t('largeTargets'))}
      <section className="hx-stack">
        <h3 className="hx-muted" style={{ margin: 0, fontSize: 14 }}>
          🔒 {t('privacy')}
        </h3>
        <p className="hx-small" style={{ margin: 0 }}>
          {t('cameraStays')} {privacy === 'on-device' ? t('speechLocal') : t('speechCloud')}
        </p>
        {privacy !== 'on-device' && (
          <button className="hx-btn hx-btn--ghost" onClick={() => void rt.recognizer.installLocal().then(() => rt.recognizer.checkLocal())}>
            Try on-device speech
          </button>
        )}
      </section>
      <button className="hx-btn hx-btn--ghost" onClick={() => { localStorage.removeItem('hocus.settings.v1'); location.reload(); }}>
        {t('resetSettings')}
      </button>
    </Drawer>
  );
}
