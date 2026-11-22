import { useRuntime, useUi } from '../hooks.ts';
import { t } from '../i18n/index.ts';

export interface AppLink {
  id: string;
  title: string;
  blurb: string;
  href: string;
}

/** Landing overlay over the live scene: the mouse works at once, the camera is optional. */
export function Landing({ apps, onDemo }: { apps: AppLink[]; onDemo: () => void }) {
  const rt = useRuntime();
  const show = useUi((s) => s.landing);
  if (!show) return null;
  const dismiss = () => rt.ui.setState({ landing: false, onboarding: !rt.settings.onboarded });
  return (
    <div className="hx-landing" role="dialog" aria-modal="false" aria-labelledby="hx-landing-title">
      <div className="hx-landing__card">
        <h1 id="hx-landing-title">{t('tagline')}</h1>
        <p style={{ fontSize: 18, margin: 0 }}>{t('landingLine')}</p>
        <div className="hx-row">
          <button
            className="hx-btn hx-btn--primary hx-btn--big"
            onClick={() => {
              void rt.startCamera();
              rt.updateSettings({ inputMode: 'auto' });
              dismiss();
            }}
          >
            📷 {t('startCamera')}
          </button>
          <button
            className="hx-btn hx-btn--big"
            onClick={() => {
              rt.updateSettings({ inputMode: 'mouse' });
              rt.ui.setState({ landing: false });
            }}
          >
            🖱 {t('useMouse')}
          </button>
          <button
            className="hx-btn hx-btn--ghost hx-btn--big"
            onClick={() => {
              rt.ui.setState({ landing: false });
              onDemo();
            }}
          >
            ▶ {t('watchDemo')}
          </button>
        </div>
        <div className="hx-landing__apps">
          {apps.map((a) => (
            <a key={a.id} className="hx-card" href={a.href} aria-current={a.id === rt.app.id ? 'page' : undefined}>
              <b>{a.title}</b>
              <div className="hx-small hx-muted">{a.blurb}</div>
            </a>
          ))}
        </div>
        <p className="hx-small hx-muted" style={{ margin: 0 }}>
          🔒 {t('cameraStays')}
        </p>
      </div>
    </div>
  );
}
