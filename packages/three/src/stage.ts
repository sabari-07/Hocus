import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import type { Hit, Rect, SurfacePoint } from '@hocus/core';
import { PALETTE } from './palette.ts';

export interface StageOptions {
  background?: number;
  fov?: number;
  cameraPosition?: [number, number, number];
  lookAt?: [number, number, number];
  bloom?: { strength: number; radius: number; threshold: number } | false;
  reducedMotion?: boolean;
  /** Extra forgiving margin around objects for pointing, in CSS px. */
  margin?: number;
  /** Aria label describing the scene for screen readers. */
  label: string;
}

interface Registered {
  id: string;
  root: THREE.Object3D;
  /** Optional explicit pick radius in world units (otherwise from the bounding sphere). */
  radius?: number;
}

export type HighlightMode = 'hover' | 'locked' | 'ambiguous';

export type FrameCallback = (dtSec: number, tMs: number) => void;

/**
 * The Hocus three.js stage: renderer, camera, post-processing, CSS2D labels, a registry of
 * pointable objects and pickable surfaces. Screen-space hit testing runs at capture time so
 * every PointerSample carries the hits that were true *then* (objects move).
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly labels = new CSS2DRenderer();
  readonly container: HTMLElement;
  reducedMotion: boolean;
  private baseFov: number;
  /** True while the WebGL context is lost (the scene is not drawing). */
  contextLost = false;
  private lossCbs = new Set<(lost: boolean) => void>();
  private composer: EffectComposer;
  private outlines: Record<HighlightMode, OutlinePass>;
  private registry = new Map<string, Registered>();
  private surfaces = new Map<string, THREE.Object3D>();
  private chips = new Map<string, CSS2DObject>();
  private frameCbs = new Set<FrameCallback>();
  private raycaster = new THREE.Raycaster();
  private running = false;
  private last = 0;
  private resizeObs: ResizeObserver;
  private margin: number;
  private highlightIds: Record<HighlightMode, string[]> = { hover: [], locked: [], ambiguous: [] };
  /** Evidence auras: a soft additive halo per object whose opacity follows live evidence. */
  private auras = new Map<string, { sprite: THREE.Sprite; target: number }>();
  private auraTexture: THREE.Texture | null = null;

  constructor(container: HTMLElement, opts: StageOptions) {
    this.container = container;
    this.reducedMotion = opts.reducedMotion ?? false;
    this.margin = opts.margin ?? 18;
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    const canvas = this.renderer.domElement;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', opts.label);
    canvas.className = 'hx-canvas';
    container.appendChild(canvas);
    // GPU drivers can drop the WebGL context (sleep, driver reset, too many contexts). three.js restores it by
    // itself; we only tell the UI so the user sees a message instead of a blank stage.
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
      for (const cb of this.lossCbs) cb(true);
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      for (const cb of this.lossCbs) cb(false);
    });

    this.labels.setSize(w, h);
    this.labels.domElement.className = 'hx-labels';
    this.labels.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(this.labels.domElement);

    this.scene.background = new THREE.Color(opts.background ?? PALETTE.bg);
    this.baseFov = opts.fov ?? 45;
    this.camera = new THREE.PerspectiveCamera(this.baseFov, w / h, 0.05, 500);
    const cp = opts.cameraPosition ?? [0, 4, 10];
    this.camera.position.set(cp[0], cp[1], cp[2]);
    const la = opts.lookAt ?? [0, 0, 0];
    this.camera.lookAt(la[0], la[1], la[2]);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (opts.bloom !== false) {
      const b = opts.bloom ?? { strength: 0.7, radius: 0.5, threshold: 0.82 };
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), b.strength, b.radius, b.threshold));
    }
    const mk = (color: number, strength: number) => {
      const p = new OutlinePass(new THREE.Vector2(w, h), this.scene, this.camera);
      p.visibleEdgeColor.set(color);
      p.hiddenEdgeColor.set(color).multiplyScalar(0.35);
      p.edgeStrength = strength;
      p.edgeThickness = 2.2;
      p.edgeGlow = 0.6;
      p.enabled = false;
      this.composer.addPass(p);
      return p;
    };
    this.outlines = { hover: mk(PALETTE.violet, 3), locked: mk(PALETTE.teal, 5), ambiguous: mk(PALETTE.amber, 5) };
    this.composer.addPass(new OutputPass());

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
  }

  // ------------------------------------------------------------ lifecycle

  onFrame(cb: FrameCallback): () => void {
    this.frameCbs.add(cb);
    return () => this.frameCbs.delete(cb);
  }

  /** Be told when the GPU context is lost (`true`) and restored (`false`). */
  onContextLoss(cb: (lost: boolean) => void): () => void {
    this.lossCbs.add(cb);
    return () => this.lossCbs.delete(cb);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.renderer.setAnimationLoop((now: number) => {
      // Never negative (the first rAF timestamp can precede `last`) and never a huge jump after a stall.
      const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      for (const cb of this.frameCbs) cb(dt, now);
      this.updateAuras(dt);
      this.composer.render(dt);
      this.labels.render(this.scene, this.camera);
    });
  }

  stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  dispose() {
    this.stop();
    this.resizeObs.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.domElement.remove();
  }

  resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    // Portrait screens: widen the vertical FOV so the scene's width still fits (capped to avoid fisheye).
    const widen = Math.min(1.9, Math.max(1, 1.2 / this.camera.aspect));
    const half = Math.tan(THREE.MathUtils.degToRad(this.baseFov) / 2) * widen;
    this.camera.fov = THREE.MathUtils.radToDeg(Math.atan(half)) * 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.labels.setSize(w, h);
  }

  /** PNG data URL of the current frame. */
  snapshot(): string {
    this.composer.render(0);
    return this.renderer.domElement.toDataURL('image/png');
  }

  // ------------------------------------------------------------ registry

  register(id: string, root: THREE.Object3D, opts: { radius?: number } = {}) {
    root.userData.hocusId = id;
    this.registry.set(id, { id, root, ...(opts.radius != null ? { radius: opts.radius } : {}) });
  }

  unregister(id: string) {
    this.registry.delete(id);
    this.setChip(id, null);
  }

  has(id: string) {
    return this.registry.has(id);
  }

  ids(): string[] {
    return [...this.registry.keys()];
  }

  object(id: string): THREE.Object3D | undefined {
    return this.registry.get(id)?.root;
  }

  addSurface(name: string, obj: THREE.Object3D) {
    this.surfaces.set(name, obj);
  }

  // ------------------------------------------------------------ projection

  private rect() {
    return this.renderer.domElement.getBoundingClientRect();
  }

  /** World -> client (CSS px) coordinates. */
  toScreen(world: THREE.Vector3): { x: number; y: number; behind: boolean } {
    const r = this.rect();
    this.camera.updateMatrixWorld();
    const behind = world.clone().applyMatrix4(this.camera.matrixWorldInverse).z > -this.camera.near;
    const v = world.clone().project(this.camera);
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, behind };
  }

  private sphereOf(reg: Registered): THREE.Sphere {
    const box = new THREE.Box3().setFromObject(reg.root);
    const s = box.getBoundingSphere(new THREE.Sphere());
    if (reg.radius != null) s.radius = reg.radius * Math.max(reg.root.scale.x, 0.001);
    return s;
  }

  /** Projected centre and radius (px) of a registered object. */
  screenOf(id: string): { x: number; y: number; r: number } | null {
    const reg = this.registry.get(id);
    if (!reg) return null;
    const s = this.sphereOf(reg);
    const c = this.toScreen(s.center);
    if (c.behind) return null;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion).multiplyScalar(s.radius);
    const e = this.toScreen(s.center.clone().add(right));
    return { x: c.x, y: c.y, r: Math.max(4, Math.hypot(e.x - c.x, e.y - c.y)) };
  }

  /** Screen-space bounding rects, used by the lasso. */
  projectRects(): Array<{ id: string; rect: Rect }> {
    const out: Array<{ id: string; rect: Rect }> = [];
    for (const reg of this.registry.values()) {
      if (!reg.root.visible) continue;
      const box = new THREE.Box3().setFromObject(reg.root);
      if (box.isEmpty()) continue;
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const cx of [box.min.x, box.max.x])
        for (const cy of [box.min.y, box.max.y])
          for (const cz of [box.min.z, box.max.z]) {
            const p = this.toScreen(new THREE.Vector3(cx, cy, cz));
            x0 = Math.min(x0, p.x);
            y0 = Math.min(y0, p.y);
            x1 = Math.max(x1, p.x);
            y1 = Math.max(y1, p.y);
          }
      out.push({ id: reg.id, rect: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } });
    }
    return out;
  }

  // ------------------------------------------------------------ hit testing

  /**
   * Hit test at client coordinates. The object under the ray gets quality 1; nearby objects get a
   * forgiving falloff to 0 at `margin` px beyond their projected silhouette. Returns the surface point too.
   */
  hitTest(clientX: number, clientY: number): { hits: Hit[]; place?: SurfacePoint } {
    const r = this.rect();
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return { hits: [] };
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const roots = [...this.registry.values()].filter((x) => x.root.visible).map((x) => x.root);
    const first = this.raycaster.intersectObjects(roots, true)[0];
    let rayId: string | undefined;
    if (first) {
      let o: THREE.Object3D | null = first.object;
      while (o && o.userData.hocusId === undefined) o = o.parent;
      rayId = o?.userData.hocusId as string | undefined;
    }
    const hits: Hit[] = [];
    for (const reg of this.registry.values()) {
      if (!reg.root.visible) continue;
      if (reg.id === rayId) {
        hits.push({ id: reg.id, quality: 1 });
        continue;
      }
      const sc = this.screenOf(reg.id);
      if (!sc) continue;
      const core = sc.r * 0.8;
      const d = Math.hypot(clientX - sc.x, clientY - sc.y);
      const margin = Math.max(this.margin, Math.min(36, sc.r * 0.35));
      const q = d <= core ? 0.9 : 0.9 * (1 - (d - core) / margin);
      if (q > 0.02) hits.push({ id: reg.id, quality: Math.min(0.9, q) });
    }
    let place: SurfacePoint | undefined;
    const surf = this.raycaster.intersectObjects([...this.surfaces.values()], true)[0];
    if (surf) {
      let o: THREE.Object3D | null = surf.object;
      let name = 'surface';
      for (const [n, so] of this.surfaces) {
        let p: THREE.Object3D | null = o;
        while (p && p !== so) p = p.parent;
        if (p === so) {
          name = n;
          break;
        }
      }
      o = null;
      place = { surface: name, world: { x: surf.point.x, y: surf.point.y, z: surf.point.z } };
    }
    return place ? { hits, place } : { hits };
  }

  // ------------------------------------------------------------ highlights and labels

  highlight(ids: string[], mode: HighlightMode | 'clear') {
    if (mode !== 'hover') this.clearChips('badge');
    if (mode === 'clear') {
      for (const m of ['locked', 'ambiguous'] as const) this.setOutline(m, []);
      return;
    }
    if (mode !== 'hover') for (const m of ['locked', 'ambiguous'] as const) if (m !== mode) this.setOutline(m, []);
    this.setOutline(mode, ids);
  }

  private setOutline(mode: HighlightMode, ids: string[]) {
    this.highlightIds[mode] = ids;
    const objs = ids.map((id) => this.registry.get(id)?.root).filter((x): x is THREE.Object3D => !!x);
    this.outlines[mode].selectedObjects = objs;
    this.outlines[mode].enabled = objs.length > 0;
    if (mode === 'ambiguous') ids.forEach((id, i) => this.setChip(id, `${i + 1}`, 'badge'));
  }

  highlighted(mode: HighlightMode) {
    return this.highlightIds[mode];
  }

  /** Floating DOM chip above an object (label or numbered badge). */
  setChip(id: string, text: string | null, kind: 'label' | 'badge' = 'label') {
    const existing = this.chips.get(id);
    if (!text) {
      if (existing) {
        existing.parent?.remove(existing);
        existing.element.remove();
        this.chips.delete(id);
      }
      return;
    }
    const reg = this.registry.get(id);
    if (!reg) return;
    let chip = existing;
    if (!chip) {
      const el = document.createElement('div');
      chip = new CSS2DObject(el);
      this.chips.set(id, chip);
      this.scene.add(chip);
    }
    chip.element.className = kind === 'badge' ? 'hx-chip hx-chip--badge' : 'hx-chip';
    chip.element.textContent = text;
    const s = this.sphereOf(reg);
    chip.position.copy(s.center).add(new THREE.Vector3(0, s.radius * 1.1, 0));
  }

  clearChips(kind?: 'badge') {
    for (const [id, c] of this.chips) if (!kind || c.element.classList.contains('hx-chip--badge')) this.setChip(id, null);
  }

  /**
   * Show how strongly each object is the current referent of "that" (0..1). Objects not in the map fade out.
   * Driven by `engine.liveEvidence` while the user is speaking or typing.
   */
  setAura(strengths: Record<string, number>) {
    for (const [id, a] of this.auras) a.target = strengths[id] ?? 0;
    for (const [id, v] of Object.entries(strengths)) {
      if (this.auras.has(id) || v <= 0.01 || !this.registry.has(id)) continue;
      this.auraTexture ??= (() => {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const g = c.getContext('2d')!;
        const grd = g.createRadialGradient(64, 64, 8, 64, 64, 64);
        grd.addColorStop(0, 'rgba(255,200,120,0.9)');
        grd.addColorStop(0.45, 'rgba(255,179,71,0.35)');
        grd.addColorStop(1, 'rgba(255,179,71,0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, 128, 128);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
      })();
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.auraTexture, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }),
      );
      sprite.renderOrder = 999;
      this.scene.add(sprite);
      this.auras.set(id, { sprite, target: v });
    }
  }

  private updateAuras(dt: number) {
    for (const [id, a] of this.auras) {
      const reg = this.registry.get(id);
      const mat = a.sprite.material as THREE.SpriteMaterial;
      if (!reg) {
        this.scene.remove(a.sprite);
        mat.dispose();
        this.auras.delete(id);
        continue;
      }
      const s = this.sphereOf(reg);
      a.sprite.position.copy(s.center);
      a.sprite.scale.setScalar(s.radius * 3.2);
      const goal = a.target * 0.85;
      mat.opacity = this.reducedMotion ? goal : THREE.MathUtils.damp(mat.opacity, goal, 10, dt);
      a.sprite.visible = mat.opacity > 0.01;
    }
  }

  /** Keep chips glued to moving objects. Call from an app frame callback if objects move. */
  updateChips() {
    for (const [id, chip] of this.chips) {
      const reg = this.registry.get(id);
      if (!reg) continue;
      const s = this.sphereOf(reg);
      chip.position.copy(s.center).add(new THREE.Vector3(0, s.radius * 1.1, 0));
    }
  }
}
