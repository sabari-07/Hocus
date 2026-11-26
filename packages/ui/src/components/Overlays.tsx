import { useEffect, useRef, useState } from 'react';
import { useCore, useRuntime, useUi } from '../hooks.ts';
import { t } from '../i18n/index.ts';

/** The Wisp pointer. Shape changes as well as colour (no colour-only signals). */
export function Wisp() {
  const p = useUi((s) => s.pointer);
  const speech = useUi((s) => s.speech);
  const core = useCore();
  if (!p || !p.active || (p.source === 'mouse' && p.pose === 'rest')) return <div className="hx-wisp" data-state="hidden" aria-hidden="true" />;
  const locked = core.phase.kind === 'preview' || core.phase.kind === 'confirm';
  const state = speech === 'listening' ? 'listening' : locked ? 'locked' : p.topHit ? 'targeting' : 'tracking';
  return (
    <div
      className="hx-wisp"
      data-state={state}
      data-pose={p.pose}
      aria-hidden="true"
      style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
    />
  );
}

/** Lasso trail (mouse shift-drag or a loop drawn in the air). */
export function LassoTrail() {
  const p = useUi((s) => s.pointer);
  const pts = p?.lasso ?? [];
  if (pts.length < 2) return null;
  return (
    <svg className="hx-lasso" aria-hidden="true">
      <polyline points={pts.map((q) => `${q.x},${q.y}`).join(' ')} fill="rgba(79,227,193,0.08)" stroke="#4FE3C1" strokeWidth={3} strokeDasharray="6 5" />
    </svg>
  );
}

/** Small mirrored camera preview with the hand skeleton and a privacy label. */
export function CameraPreview() {
  const rt = useRuntime();
  const status = useUi((s) => s.vision);
  const hand = useUi((s) => s.hand);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvas.current;
    if (!c || status !== 'running') return;
    const ctx = c.getContext('2d')!;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const v = rt.vision.video;
      if (v.readyState >= 2) ctx.drawImage(v, 0, 0, c.width, c.height);
      const lm = rt.ui.getState().hand?.landmarks;
      if (lm) {
        ctx.strokeStyle = '#FFB347';
        ctx.fillStyle = '#4FE3C1';
        ctx.lineWidth = 2;
        const B = [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [5, 9, 10, 11, 12], [9, 13, 14, 15, 16], [13, 17, 18, 19, 20], [0, 17]];
        for (const chain of B) {
          ctx.beginPath();
          chain.forEach((i, k) => {
            const q = lm[i]!;
            if (k === 0) ctx.moveTo(q.x * c.width, q.y * c.height);
            else ctx.lineTo(q.x * c.width, q.y * c.height);
          });
          ctx.stroke();
        }
        const tip = lm[8]!;
        ctx.beginPath();
        ctx.arc(tip.x * c.width, tip.y * c.height, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [status, rt]);

  if (status === 'off' || status === 'denied' || status === 'no-camera') return null;
  return (
    <figure className="hx-cam" aria-label="Camera preview">
      {status === 'running' ? <canvas ref={canvas} width={320} height={240} /> : <div className="hx-pad hx-small">{t('cameraLoading')}</div>}
      <figcaption className="hx-cam__label">
        <span>🔒 {t('cameraOn')}</span>
        <span className="hx-mono">{hand ? hand.pose : '—'}</span>
      </figcaption>
    </figure>
  );
}

/** Screen-reader live regions: polite for results, assertive for questions. */
export function LiveRegions() {
  const a = useUi((s) => s.announcement);
  return (
    <>
      <div className="hx-visually-hidden" role="status" aria-live="polite">
        {a?.politeness === 'polite' ? a.text : ''}
      </div>
      <div className="hx-visually-hidden" role="alert" aria-live="assertive">
        {a?.politeness === 'assertive' ? a.text : ''}
      </div>
    </>
  );
}

/** Warnings and info from the runtime (camera blocked, hand lost…). Spoken results go to <Echoes/>. */
export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  return (
    <div className="hx-toasts" aria-hidden="true">
      {toasts.map((x) => (
        <div key={x.id} className={`hx-toast hx-toast--${x.level}`}>
          {x.text}
        </div>
      ))}
    </div>
  );
}

interface Echo {
  id: number;
  text: string;
  kind: 'polite' | 'assertive';
}

/** What Hocus just said, as a short stack of glass cards that fade after a few seconds. aria-hidden: LiveRegions announces it. */
export function Echoes() {
  const a = useUi((s) => s.announcement);
  const [items, setItems] = useState<Echo[]>([]);
  useEffect(() => {
    if (!a) return;
    // "Make Pumpkin 1 bigger" (preview) is followed by "Make Pumpkin 1 bigger. Done…": show only the newest.
    setItems((q) => [...q.filter((x) => x.id !== a.id && !a.text.startsWith(x.text)), { id: a.id, text: a.text, kind: a.politeness }].slice(-3));
    const id = setTimeout(() => setItems((q) => q.filter((x) => x.id !== a.id)), a.politeness === 'assertive' ? 7000 : 4800);
    return () => clearTimeout(id);
  }, [a]);
  return (
    <div className="hx-echoes" aria-hidden="true">
      {items.map((e) => (
        <div key={e.id} className="hx-echo hx-glass" data-kind={e.kind}>
          <span className="hx-echo__icon">{e.kind === 'assertive' ? '❓' : '✧'}</span>
          <span>{e.text}</span>
        </div>
      ))}
    </div>
  );
}

export function JudgeCaption() {
  const rt = useRuntime();
  const j = useUi((s) => s.judge);
  if (!j) return null;
  return (
    <div className="hx-caption" role="status">
      <span className="hx-caption__dots" aria-label={`Step ${j.step} of ${j.total}`}>
        {Array.from({ length: j.total }, (_, i) => (
          <i key={i} data-on={i < j.step} />
        ))}
      </span>
      <span>{j.caption}</span>
      <button className="hx-btn hx-btn--primary" onClick={() => rt.stopJudge()}>
        {t('yourTurn')}
      </button>
    </div>
  );
}

/** Loading screen: a skeleton assembling itself (fits the Skeleton Crew theme). */
export function Loading({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="hx-loading" role="status">
      <div>
        <div className="hx-bones" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        {t('loading')}
      </div>
    </div>
  );
}
