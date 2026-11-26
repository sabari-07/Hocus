import { useRuntime, useUi } from '../hooks.ts';
import { t } from '../i18n/index.ts';
import { Icon } from './Icons.tsx';

export interface AppLink {
  id: string;
  title: string;
  blurb: string;
  href: string;
  icon?: string;
}

const ICONS: Record<string, string> = { 'room-designer': '🏚️', 'planet-explorer': '🪐', 'kitchen-board': '🍳' };

/**
 * The idea in one picture: the finger passes Pumpkin, Ghost and Cat. "that" is said while over the Ghost; the
 * recognizer only returns the text 350 ms later, when the finger is already over the Cat. Hocus binds the Ghost.
 * Decorative (aria-hidden); the caption below says the same in words.
 */
function TimingDiagram({ animate }: { animate: boolean }) {
  const nodes = [
    { x: 70, label: 'Pumpkin', c: '#FFB347' },
    { x: 210, label: 'Ghost', c: '#8E7CFF' },
    { x: 350, label: 'Cat', c: '#4FE3C1' },
  ];
  return (
    <svg viewBox="0 0 420 210" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="hx-g" r="1">
          <stop offset="0" stopColor="#FFB347" stopOpacity=".9" />
          <stop offset="1" stopColor="#FFB347" stopOpacity="0" />
        </radialGradient>
      </defs>
      <line x1="40" y1="130" x2="380" y2="130" stroke="rgba(237,234,247,.16)" strokeWidth="1" strokeDasharray="3 6" />
      {nodes.map((n) => (
        <g key={n.label}>
          <circle cx={n.x} cy="130" r="26" fill={n.c} fillOpacity=".14" stroke={n.c} strokeOpacity=".7" />
          <text x={n.x} y="176" textAnchor="middle" fill="#B9B2D0" fontSize="12" fontFamily="Inter, sans-serif">
            {n.label}
          </text>
        </g>
      ))}
      {/* the word, anchored over the Ghost */}
      <g opacity={animate ? 0 : 1}>
        {animate && <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.5;0.56;0.96;1" dur="8s" repeatCount="indefinite" />}
        <path d="M210 62 C210 90 210 100 210 104" stroke="#4FE3C1" strokeWidth="2" strokeDasharray="4 5" fill="none" />
        <rect x="170" y="30" width="80" height="30" rx="15" fill="rgba(79,227,193,.12)" stroke="#4FE3C1" />
        <text x="210" y="50" textAnchor="middle" fill="#4FE3C1" fontSize="15" fontWeight="600" fontFamily="Inter, sans-serif">
          “that”
        </text>
        <text x="210" y="20" textAnchor="middle" fill="#B9B2D0" fontSize="11" fontFamily="Inter, sans-serif">
          said here
        </text>
      </g>
      {/* the pointer: Pumpkin -> Ghost (dwell) -> Cat */}
      <g>
        <circle r="30" fill="url(#hx-g)" opacity=".5" cx="0" cy="0" transform={animate ? undefined : 'translate(350 130)'} />
        <circle r="13" fill="none" stroke="#FFB347" strokeWidth="3" cx="0" cy="0" transform={animate ? undefined : 'translate(350 130)'} />
        <circle r="3" fill="#FFB347" cx="0" cy="0" transform={animate ? undefined : 'translate(350 130)'} />
        {animate && (
          <animateMotion
            dur="8s"
            repeatCount="indefinite"
            path="M70 130 L350 130"
            keyPoints="0;0;0.5;0.5;1;1"
            keyTimes="0;0.12;0.32;0.62;0.78;1"
            calcMode="linear"
          />
        )}
      </g>
      {/* the late text arrives while the pointer is already on the Cat */}
      <g opacity={animate ? 0 : 1}>
        {animate && <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.72;0.78;0.96;1" dur="8s" repeatCount="indefinite" />}
        <text x="350" y="100" textAnchor="middle" fill="#FF5D73" fontSize="11" fontFamily="Inter, sans-serif">
          text arrives: finger is here
        </text>
        <text x="210" y="198" textAnchor="middle" fill="#4FE3C1" fontSize="12" fontWeight="600" fontFamily="Inter, sans-serif">
          Hocus binds: Ghost
        </text>
      </g>
    </svg>
  );
}

/** Landing overlay over the live 3D scene: the mouse works at once, the camera is optional. */
export function Landing({ apps, onDemo }: { apps: AppLink[]; onDemo: () => void }) {
  const rt = useRuntime();
  const show = useUi((s) => s.landing);
  if (!show) return null;
  const reduced = rt.settings.reducedMotion;
  const dismiss = () => rt.ui.setState({ landing: false, onboarding: !rt.settings.onboarded });
  return (
    <div className="hx-landing" role="dialog" aria-modal="false" aria-labelledby="hx-landing-title">
      <div className="hx-landing__card">
        <div className="hx-hero">
          <p className="hx-hero__kicker">Hocus · Kiroween 2026 · Skeleton Crew</p>
          <h1 id="hx-landing-title">{t('tagline')}</h1>
          <p className="hx-hero__lead">{t('heroLead')}</p>
          <p className="hx-hero__body">{t('heroBody')}</p>
          <div className="hx-hero__cta">
            <button
              className="hx-btn hx-btn--primary hx-btn--big"
              onClick={() => {
                void rt.startCamera();
                rt.updateSettings({ inputMode: 'auto' });
                dismiss();
              }}
            >
              <Icon name="camera" size={22} /> {t('startCamera')}
            </button>
            <button
              className="hx-btn hx-btn--big"
              onClick={() => {
                rt.updateSettings({ inputMode: 'mouse' });
                rt.ui.setState({ landing: false });
              }}
            >
              <Icon name="wisp" size={22} /> {t('useMouse')}
            </button>
            <button
              className="hx-btn hx-btn--ghost hx-btn--big"
              onClick={() => {
                rt.ui.setState({ landing: false });
                onDemo();
              }}
            >
              <Icon name="play" size={20} /> {t('watchDemo')}
            </button>
          </div>
          <ul className="hx-inputs" aria-label="Works with">
            <li>✋ Hand</li>
            <li>🙂 Head</li>
            <li>🖱 Mouse</li>
            <li>👆 Touch</li>
            <li>🎙 Voice</li>
            <li>⌨ Typing</li>
            <li>हि · தமிழ் · EN</li>
          </ul>
        </div>

        <figure className="hx-hero__demo hx-glass" style={{ margin: 0 }}>
          <TimingDiagram animate={!reduced} />
          <figcaption>
            Recognizers return text a third of a second late. By then your finger has moved. Hocus looks back to where it was{' '}
            <i>when you said the word</i>, shows what it understood, and asks if it is unsure.
          </figcaption>
        </figure>

        <section className="hx-portals" aria-label={t('portals')}>
          <h2>{t('portals')}</h2>
          <div className="hx-portals__grid">
            {apps.map((a) => (
              <a key={a.id} className="hx-card hx-glass" href={a.href} aria-current={a.id === rt.app.id ? 'page' : undefined}>
                <span className="hx-card__icon" aria-hidden="true">
                  {a.icon ?? ICONS[a.id] ?? '✨'}
                </span>
                <b>{a.title}</b>
                <span>{a.blurb}</span>
              </a>
            ))}
          </div>
        </section>
        <p className="hx-small hx-muted" style={{ gridColumn: '1 / -1', margin: 0 }}>
          🔒 {t('cameraStays')}
        </p>
      </div>
    </div>
  );
}
