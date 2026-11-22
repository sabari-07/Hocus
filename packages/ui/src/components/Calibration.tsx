import { useEffect, useState } from 'react';
import { solveHomography, type Pt } from '@hocus/input';
import { useRuntime, useUi } from '../hooks.ts';

const CORNERS: Pt[] = [
  { x: 0.08, y: 0.1 },
  { x: 0.92, y: 0.1 },
  { x: 0.92, y: 0.9 },
  { x: 0.08, y: 0.9 },
];

/**
 * Optional four-corner calibration (F-I7): point at each glowing corner and press Enter.
 * Replaces the virtual touchpad with a homography from camera space to the stage.
 */
export function CornerCalibration() {
  const rt = useRuntime();
  const open = useUi((s) => s.calibrating);
  const [i, setI] = useState(0);
  const [raw, setRaw] = useState<Pt[]>([]);

  useEffect(() => {
    if (!open) return;
    setI(0);
    setRaw([]);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') rt.ui.setState({ calibrating: false });
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const p = rt.hub?.rawHand;
      if (!p) {
        rt.toast('Show your pointing hand to the camera first.', 'warning');
        return;
      }
      setRaw((r) => {
        const next = [...r, p];
        if (next.length === 4 && rt.hub) {
          const s = rt.hub.size();
          const dst = CORNERS.map((c) => ({ x: c.x * s.width, y: c.y * s.height }));
          const H = solveHomography(next, dst);
          rt.hub.setCalibration(H);
          rt.toast(H ? 'Corners calibrated.' : 'Calibration failed. Try again with your hand fully in view.', H ? 'info' : 'warning');
          rt.ui.setState({ calibrating: false });
        }
        setI(next.length);
        return next;
      });
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [open, rt]);

  if (!open) return null;
  const c = CORNERS[Math.min(i, 3)]!;
  return (
    <div className="hx-landing" role="dialog" aria-modal="true" aria-label="Corner calibration">
      <div
        aria-hidden="true"
        style={{ position: 'fixed', left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: 56, height: 56, margin: -28, borderRadius: '50%', border: '4px solid var(--hx-teal)', boxShadow: '0 0 30px var(--hx-teal)' }}
      />
      <div className="hx-landing__card" style={{ textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--hx-font-display)', color: 'var(--hx-amber)', margin: 0 }}>Corner {Math.min(i + 1, 4)} of 4</h2>
        <p>Point at the glowing circle and press Enter. Esc cancels. {raw.length ? `${raw.length} captured.` : ''}</p>
        <button className="hx-btn hx-btn--ghost" onClick={() => { rt.hub?.setCalibration(null); rt.ui.setState({ calibrating: false }); }}>
          Use the default mapping
        </button>
      </div>
    </div>
  );
}
