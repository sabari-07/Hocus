import { OneEuro2D, detectLoop, selectInLoop, type HocusEvent, type Hit, type PointerPose, type PointerSample, type PointerSource, type Rect, type SurfacePoint } from '@hocus/core';
import { applyHomography, touchpadMap, type Pt } from './mapping.ts';

export interface HitTester {
  hitTest(x: number, y: number): { hits: Hit[]; place?: SurfacePoint };
  projectRects(): Array<{ id: string; rect: Rect }>;
}

/** What a tracker (hand/head) reports each frame, in camera-normalized coordinates. */
export interface TrackerFrame {
  nx: number;
  ny: number;
  conf: number;
  pose: PointerPose;
  aperture?: number;
}

export type InputMode = 'auto' | 'hand' | 'head' | 'mouse' | 'touch';

export interface HubOptions {
  element: HTMLElement;
  hitTester: HitTester;
  dispatch: (e: HocusEvent) => void;
  now?: () => number;
  hz?: number;
}

export interface PointerView {
  x: number;
  y: number;
  source: PointerSource;
  pose: PointerPose;
  active: boolean;
  topHit?: string;
  lasso: Pt[];
}

/**
 * Collects pointer positions from every source, picks the active one, smooths camera-based
 * sources (One Euro), hit-tests at capture time and emits `PointerSample`s at a fixed rate.
 * Mouse clicks and taps become `select` events (keyboard/mouse parity). Shift-drag or a hand
 * loop becomes a `lasso` event.
 */
export class PointerHub {
  mode: InputMode = 'auto';
  private el: HTMLElement;
  private ht: HitTester;
  private dispatch: (e: HocusEvent) => void;
  private now: () => number;
  private hz: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private mouse: (Pt & { inside: boolean; t: number }) | null = null;
  private touch: (Pt & { t: number }) | null = null;
  private hand: (Pt & TrackerFrame & { t: number }) | null = null;
  private head: (Pt & TrackerFrame & { t: number }) | null = null;
  private handFilter = new OneEuro2D({ minCutoff: 1.0, beta: 0.01, dCutoff: 1 });
  private headFilter = new OneEuro2D({ minCutoff: 0.6, beta: 0.006, dCutoff: 1 });
  private homography: number[] | null = null;
  private trail: Array<Pt & { t: number }> = [];
  private lassoDrag: Pt[] | null = null;
  private listeners = new Set<(v: PointerView) => void>();
  private down: { x: number; y: number; t: number } | null = null;
  view: PointerView = { x: -100, y: -100, source: 'mouse', pose: 'rest', active: false, lasso: [] };
  /** Pad fraction for the virtual touchpad (smaller = less arm movement). */
  pad = 0.6;
  /** Pause camera pointing (e.g. while typing). */
  paused = false;
  /** Last raw (unmapped, mirrored) hand position, used by four-corner calibration. */
  rawHand: Pt | null = null;

  constructor(o: HubOptions) {
    this.el = o.element;
    this.ht = o.hitTester;
    this.dispatch = o.dispatch;
    this.now = o.now ?? (() => performance.now());
    this.hz = o.hz ?? 30;
    this.el.addEventListener('pointermove', this.onMove);
    this.el.addEventListener('pointerdown', this.onDown);
    this.el.addEventListener('pointerup', this.onUp);
    this.el.addEventListener('pointerleave', this.onLeave);
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 1000 / this.hz);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  dispose() {
    this.stop();
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerdown', this.onDown);
    this.el.removeEventListener('pointerup', this.onUp);
    this.el.removeEventListener('pointerleave', this.onLeave);
  }

  subscribe(fn: (v: PointerView) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setSmoothing(p: { minCutoff?: number; beta?: number }) {
    this.handFilter.setParams(p);
  }

  setCalibration(H: number[] | null) {
    this.homography = H;
  }

  /** Element size, for calibration targets. */
  size() {
    const r = this.el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  // ------------------------------------------------------------ sources

  /** Called by the hand tracker with camera-normalized coordinates. */
  feedHand(f: TrackerFrame | null) {
    if (!f) {
      this.hand = null;
      this.handFilter.reset();
      return;
    }
    const t = this.now();
    this.rawHand = { x: 1 - f.nx, y: f.ny };
    const p = this.mapCamera(f.nx, f.ny);
    const [x, y] = this.handFilter.filter(p.x, p.y, t);
    this.hand = { ...f, x, y, t };
  }

  feedHead(f: TrackerFrame | null) {
    if (!f) {
      this.head = null;
      this.headFilter.reset();
      return;
    }
    const t = this.now();
    // Head pointing uses a tighter pad: small head turns cover the screen.
    const w = window.innerWidth;
    const h = window.innerHeight;
    const p = touchpadMap(f.nx, f.ny, w, h, 0.25);
    const [x, y] = this.headFilter.filter(p.x, p.y, t);
    this.head = { ...f, x, y, t };
  }

  private mapCamera(nx: number, ny: number): Pt {
    const r = this.el.getBoundingClientRect();
    if (this.homography) {
      const p = applyHomography(this.homography, { x: 1 - nx, y: ny });
      return { x: r.left + p.x, y: r.top + p.y };
    }
    const p = touchpadMap(nx, ny, r.width, r.height, this.pad);
    return { x: r.left + p.x, y: r.top + p.y };
  }

  /** Only the 3D canvas (or the transparent label layer) counts as pointing; UI overlays never do. */
  private onScene(e: PointerEvent) {
    const el = e.target as Element | null;
    return !el || el instanceof HTMLCanvasElement || (el as HTMLElement).classList?.contains('hx-labels') || el === this.el;
  }

  private onMove = (e: PointerEvent) => {
    const t = this.now();
    const inside = this.onScene(e);
    if (e.pointerType === 'touch') this.touch = inside ? { x: e.clientX, y: e.clientY, t } : null;
    else this.mouse = { x: e.clientX, y: e.clientY, inside, t };
    if (this.lassoDrag) this.lassoDrag.push({ x: e.clientX, y: e.clientY });
  };

  private onDown = (e: PointerEvent) => {
    if (!this.onScene(e)) {
      this.down = null;
      return;
    }
    this.down = { x: e.clientX, y: e.clientY, t: this.now() };
    if (e.shiftKey && e.pointerType !== 'touch') {
      this.lassoDrag = [{ x: e.clientX, y: e.clientY }];
      this.el.setPointerCapture?.(e.pointerId);
    }
    if (e.pointerType === 'touch') this.touch = { x: e.clientX, y: e.clientY, t: this.now() };
  };

  private onUp = (e: PointerEvent) => {
    const t = this.now();
    if (this.lassoDrag) {
      const loop = this.lassoDrag;
      this.lassoDrag = null;
      if (loop.length > 6) this.emitLasso(loop, t);
      return;
    }
    const d = this.down;
    this.down = null;
    if (e.pointerType === 'touch') this.touch = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || t - d.t > 600) return;
    // A click or tap selects (keyboard/mouse parity path).
    const { hits, place } = this.ht.hitTest(e.clientX, e.clientY);
    const top = [...hits].sort((a, b) => b.quality - a.quality)[0];
    if (top && top.quality >= 0.5) this.dispatch({ type: 'select', t, ids: [top.id], mode: e.shiftKey ? 'add' : 'replace' });
    else this.dispatch({ type: 'select', t, ids: [], mode: 'clear', ...(place ? { place } : {}) });
  };

  private onLeave = () => {
    if (this.mouse) this.mouse = { ...this.mouse, inside: false };
  };

  private emitLasso(loop: Pt[], t: number) {
    const ids = selectInLoop(loop, this.ht.projectRects(), 0.6);
    if (ids.length) this.dispatch({ type: 'lasso', t, ids });
    this.view = { ...this.view, lasso: loop };
    this.emitView();
    setTimeout(() => {
      this.view = { ...this.view, lasso: [] };
      this.emitView();
    }, 700);
  }

  // ------------------------------------------------------------ sampling

  private pick(t: number): { p: Pt; source: PointerSource; pose: PointerPose; conf: number; aperture?: number } | null {
    const fresh = (x: { t: number } | null, ms: number) => !!x && t - x.t < ms;
    const handOk = fresh(this.hand, 500) && !this.paused;
    const headOk = fresh(this.head, 500) && !this.paused;
    const m = this.mode;
    if ((m === 'hand' || m === 'auto') && handOk && this.hand)
      return { p: this.hand, source: 'hand', pose: this.hand.pose, conf: this.hand.conf, ...(this.hand.aperture != null ? { aperture: this.hand.aperture } : {}) };
    if ((m === 'head' || m === 'auto') && headOk && this.head) return { p: this.head, source: 'head', pose: 'point', conf: this.head.conf };
    if (this.touch && (m === 'touch' || m === 'auto')) return { p: this.touch, source: 'touch', pose: 'point', conf: 1 };
    if (this.mouse && (m === 'mouse' || m === 'auto' || m === 'hand' || m === 'head'))
      return { p: this.mouse, source: 'mouse', pose: this.mouse.inside ? 'point' : 'rest', conf: 1 };
    return null;
  }

  private tick() {
    const t = this.now();
    const cur = this.pick(t);
    if (!cur) {
      if (this.view.active) {
        this.view = { ...this.view, active: false };
        this.emitView();
      }
      return;
    }
    const { hits, place } = cur.pose === 'point' ? this.ht.hitTest(cur.p.x, cur.p.y) : { hits: [] as Hit[] };
    const sample: PointerSample = {
      t,
      x: cur.p.x,
      y: cur.p.y,
      conf: cur.conf,
      source: cur.source,
      pose: cur.pose,
      hits,
      ...(place ? { place } : {}),
      ...(cur.aperture != null ? { aperture: cur.aperture } : {}),
    };
    this.dispatch({ type: 'pointer', sample });
    // Hand lasso: a closed loop drawn in the air while pointing.
    if (cur.source === 'hand' && cur.pose === 'point') {
      this.trail.push({ x: cur.p.x, y: cur.p.y, t });
      this.trail = this.trail.filter((q) => t - q.t < 2500);
      const loop = detectLoop(this.trail, 45, 500, 300);
      if (loop) {
        this.trail = [];
        this.emitLasso(loop, t);
      }
    } else this.trail = [];
    const top = [...hits].sort((a, b) => b.quality - a.quality)[0];
    this.view = {
      x: cur.p.x,
      y: cur.p.y,
      source: cur.source,
      pose: cur.pose,
      active: true,
      ...(top && top.quality > 0.5 ? { topHit: top.id } : {}),
      lasso: this.lassoDrag ?? this.view.lasso,
    };
    this.emitView();
  }

  private emitView() {
    for (const fn of this.listeners) fn(this.view);
  }
}
