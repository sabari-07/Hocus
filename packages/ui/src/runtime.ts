import {
  createEngine,
  getPack,
  parse,
  parseReplayFile,
  type AppDefinition,
  type CoreState,
  type DecisionRecord,
  type Effect,
  type Engine,
  type FusionConfig,
  type HocusEvent,
  type LangCode,
  type LivePreview,
  type ReplayFile,
  type SpeechEvent,
} from '@hocus/core';
import { PointerHub, type InputMode, type PointerView } from '@hocus/input';
import { Cues, Proposer, Recognizer, Voice, type SpeechPrivacy, type SpeechStatus } from '@hocus/speech';
import { THREE, type Stage } from '@hocus/three';
import { GestureLatch, VisionTracker, type HandFrame, type VisionStatus } from '@hocus/vision';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { setUiLang, t } from './i18n/index.ts';

export interface Settings {
  lang: LangCode;
  inputMode: InputMode;
  voiceFeedback: boolean;
  sounds: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  largeTargets: boolean;
  smoothing: number; // 0..1 (higher = steadier, slower)
  dwell: number; // minEvidence
  lagMs: number;
  alwaysListening: boolean;
  proposer: boolean;
  headPointer: boolean;
  /** Nod = confirm, shake = cancel (runs face tracking even when the head is not the pointer). */
  headGestures: boolean;
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: 'en',
  inputMode: 'auto',
  voiceFeedback: false,
  sounds: true,
  reducedMotion: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  highContrast: false,
  largeTargets: false,
  smoothing: 0.5,
  dwell: 0.08,
  lagMs: 350,
  alwaysListening: false,
  proposer: false,
  headPointer: false,
  headGestures: false,
  onboarded: false,
};

export interface Announcement {
  id: number;
  text: string;
  politeness: 'polite' | 'assertive';
}

export interface Toast {
  id: number;
  text: string;
  level: 'info' | 'warning';
}

export interface UiState {
  settings: Settings;
  pointer: PointerView | null;
  vision: VisionStatus;
  speech: SpeechStatus;
  privacy: SpeechPrivacy;
  interim: string;
  announcement: Announcement | null;
  toasts: Toast[];
  xray: boolean;
  spellbook: boolean;
  settingsOpen: boolean;
  onboarding: boolean;
  calibrating: boolean;
  landing: boolean;
  judge: { playing: boolean; caption: string; step: number; total: number } | null;
  hand: HandFrame | null;
  selectedDecision: number | null;
  /** Text in the typed box (not yet sent); previewed live. */
  draft: string;
  /** What the current interim transcript or draft would do if it were final now. */
  live: { text: string; preview: LivePreview } | null;
  panels: { left: boolean; right: boolean; log: boolean };
}

/** An app's 3D scene. `sync` is called after every document change. */
export interface SceneController<S> {
  sync(state: S, runtime: HocusRuntime<S>): void;
  /** Visual reaction to an executed action (bursts, camera moves). */
  onExecuted?(action: string, args: Record<string, unknown>, ids: string[]): void;
  dispose(): void;
}

export interface JudgeStep {
  /** Selectable id to point at, or a world point on a surface. */
  point?: string | { x: number; y: number; z: number };
  say?: string;
  caption: string;
  /** Extra wait after the step, ms. */
  wait?: number;
  /** Optional hand aperture for "this big". */
  aperture?: number;
}

const KEY = 'hocus.settings.v1';
const MAX_LOG = 60_000;
let seq = 1;

/**
 * Wires the pure engine to the world: the three.js stage, pointer hub, vision, speech, sound,
 * UI store and session log. Everything the user does becomes a `HocusEvent`; every reaction is
 * an engine `Effect`.
 */
export class HocusRuntime<S> {
  readonly engine: Engine<S>;
  readonly ui: StoreApi<UiState>;
  state: CoreState<S>;
  log: HocusEvent[] = [];
  stage: Stage | null = null;
  hub: PointerHub | null = null;
  scene: SceneController<S> | null = null;
  readonly vision = new VisionTracker();
  readonly recognizer: Recognizer;
  readonly voice = new Voice();
  readonly cues = new Cues();
  readonly proposer = new Proposer();
  private listeners = new Set<() => void>();
  private tickTimer: ReturnType<typeof setInterval>;
  private liveTimer: ReturnType<typeof setInterval>;
  private latch = new GestureLatch();
  private handLostTimer: ReturnType<typeof setTimeout> | null = null;
  private judgeAbort = false;
  private scripted: { x: number; y: number } | null = null;

  constructor(readonly app: AppDefinition<S>, opts: { config?: Partial<FusionConfig> } = {}) {
    const settings = loadSettings();
    const wide = typeof innerWidth === 'number' && innerWidth >= 1200;
    this.engine = createEngine(app, opts.config);
    this.state = this.engine.initial({ lang: settings.lang, config: { lagMs: settings.lagMs, minEvidence: settings.dwell } });
    this.ui = createStore<UiState>(() => ({
      settings,
      pointer: null,
      vision: 'off',
      speech: 'idle',
      privacy: 'unknown',
      interim: '',
      announcement: null,
      toasts: [],
      xray: false,
      spellbook: false,
      settingsOpen: false,
      onboarding: false,
      calibrating: false,
      landing: !new URLSearchParams(location.search).has('skipLanding'),
      judge: null,
      hand: null,
      selectedDecision: null,
      draft: '',
      live: null,
      panels: { left: wide, right: wide, log: false },
    }));
    setUiLang(settings.lang);
    this.voice.enabled = settings.voiceFeedback;
    this.cues.enabled = settings.sounds;
    this.proposer.enabled = settings.proposer;
    void this.proposer.check();

    this.recognizer = new Recognizer({ lang: settings.lang, bcp47: getPack(settings.lang).bcp47, emit: (e) => void this.onSpeech(e), preferLocal: true });
    this.ui.setState({ speech: this.recognizer.status });
    this.recognizer.onStatus((s) => {
      this.ui.setState({ speech: s });
      if (s === 'denied') this.toast(t('speechUnsupported'), 'warning');
    });
    void this.recognizer.checkLocal().then((p) => this.ui.setState({ privacy: p }));

    this.vision.onStatus((s) => {
      this.ui.setState({ vision: s });
      if (s === 'denied') this.toast(t('cameraDenied'), 'warning');
      if (s === 'no-camera') this.toast(t('noCamera'), 'warning');
    });
    this.vision.onHand = (f) => this.onHand(f);
    // The head only steers the pointer when "head pointer" is on; gestures work either way.
    this.vision.onHead = (f) => {
      if (this.settings.headPointer) this.hub?.feedHead(f);
    };
    this.vision.onHeadGesture = (g) => {
      this.dispatch({ type: 'gesture', t: performance.now(), gesture: g });
      this.toast(g === 'confirm' ? '🙂 Nod: confirmed' : '🙂 Shake: cancelled');
    };

    this.tickTimer = setInterval(() => {
      const k = this.state.phase.kind;
      if (k === 'preview' || k === 'ask' || k === 'confirm') this.dispatch({ type: 'tick', t: performance.now() });
    }, 50);
    this.liveTimer = setInterval(() => this.updateLive(), 100);
  }

  /**
   * Live feedback, 10 times a second, through the engine's pure `preview` and `liveEvidence`:
   * while speaking or typing, the scene shows which object "that" would mean right now and the
   * speech bar shows the command Hocus would run.
   */
  private updateLive() {
    if (!this.stage) return;
    const ui = this.ui.getState();
    const listening = ui.speech === 'listening' || !!ui.judge;
    const text = ui.interim || ui.draft;
    const busy = this.state.phase.kind !== 'idle' && this.state.phase.kind !== 'listening';
    if ((!listening && !ui.draft) || busy) {
      this.stage.setAura({});
      if (ui.live) this.ui.setState({ live: null });
      return;
    }
    const now = performance.now();
    const ranked = this.engine.liveEvidence(this.state, now - 120);
    const best = ranked[0]?.evidence ?? 0;
    const scale = Math.max(best, this.state.config.minEvidence * 2);
    const auras: Record<string, number> = {};
    for (const c of ranked.slice(0, 4)) if (c.evidence >= this.state.config.minEvidence * 0.3) auras[c.id] = Math.min(1, c.evidence / scale);
    this.stage.setAura(auras);
    const preview = text ? this.engine.preview(this.state, text, now, !ui.interim) : null;
    this.ui.setState({ live: preview && text ? { text, preview } : null });
  }

  // ------------------------------------------------------------ wiring

  attachStage(stage: Stage, scene: SceneController<S>) {
    this.stage = stage;
    this.scene = scene;
    this.hub = new PointerHub({ element: stage.container, hitTester: stage, dispatch: (e) => this.dispatch(e) });
    this.hub.mode = this.settings.inputMode;
    this.applySmoothing();
    this.hub.subscribe((v) => {
      if (this.scripted) v = { ...v, x: this.scripted.x, y: this.scripted.y };
      this.ui.setState({ pointer: { ...v } });
      if (v.topHit && this.state.phase.kind === 'idle') stage.highlight([v.topHit], 'hover');
      else if (!v.topHit) stage.highlight([], 'hover');
    });
    this.hub.start();
    scene.sync(this.state.doc.app, this);
  }

  detach() {
    clearInterval(this.tickTimer);
    clearInterval(this.liveTimer);
    this.hub?.dispose();
    this.vision.stop();
    this.recognizer.abort();
    this.scene?.dispose();
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  get settings() {
    return this.ui.getState().settings;
  }

  // ------------------------------------------------------------ engine

  dispatch(e: HocusEvent) {
    const prevDoc = this.state.doc;
    const r = this.engine.step(this.state, e);
    this.state = r.state;
    this.log.push(e);
    if (this.log.length > MAX_LOG) this.log.splice(0, this.log.length - MAX_LOG);
    this.handle(r.effects);
    if (this.state.doc !== prevDoc) this.scene?.sync(this.state.doc.app, this);
    if (e.type !== 'pointer' || r.effects.length) for (const fn of this.listeners) fn();
  }

  private handle(effects: Effect[]) {
    for (const fx of effects) {
      switch (fx.type) {
        case 'announce':
          this.ui.setState({ announcement: { id: seq++, text: fx.text, politeness: fx.politeness } });
          break;
        case 'speak':
          this.voice.speak(fx.text, getPack(this.state.lang).bcp47);
          break;
        case 'highlight':
          this.stage?.highlight(fx.ids, fx.mode === 'clear' ? 'clear' : fx.mode);
          break;
        case 'sound':
          this.cues.play(fx.name);
          break;
        case 'toast':
          this.toast(fx.text, fx.level);
          break;
        case 'executed':
          this.scene?.onExecuted?.(fx.action, fx.args, fx.ids);
          break;
        case 'calibrated':
          this.updateSettings({ lagMs: Math.round(fx.lagMs) });
          break;
        case 'decision':
          this.ui.setState({ selectedDecision: fx.record.seq });
          break;
      }
    }
  }

  toast(text: string, level: 'info' | 'warning' = 'info') {
    const id = seq++;
    this.ui.setState((s) => ({ toasts: [...s.toasts, { id, text, level }].slice(-3) }));
    setTimeout(() => this.ui.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 4500);
  }

  decisions(): DecisionRecord[] {
    return this.state.decisions;
  }

  // ------------------------------------------------------------ speech + typing

  private async onSpeech(e: SpeechEvent) {
    if (e.kind === 'interim') this.ui.setState({ interim: e.text ?? '' });
    if (e.kind === 'start') this.ui.setState({ interim: '' });
    if (e.kind === 'final' && this.proposer.enabled) {
      // Only when the transcript means nothing do we ask the on-device proposer for a rewrite.
      const ctx = this.engine.parseContext(this.state);
      if (parse(e.text ?? '', ctx).type === 'no_action') {
        const allowed = Object.values(this.app.actions).flatMap((a) => a.examples?.[this.state.lang] ?? []);
        const alt = await this.proposer.propose(e.text ?? '', allowed);
        if (alt) e = { ...e, alts: [alt, ...(e.alts ?? [])] };
      }
    }
    this.dispatch({ type: 'speech', speech: e });
    if (e.kind === 'final') this.ui.setState({ interim: '' });
  }

  pushToTalk(down: boolean) {
    if (down) this.recognizer.start();
    else this.recognizer.stop();
  }

  typed(text: string) {
    const trimmed = text.trim();
    this.ui.setState({ draft: '', live: null });
    if (!trimmed) return;
    this.dispatch({ type: 'speech', speech: { t: performance.now(), kind: 'typed', text: trimmed, lang: this.state.lang } });
  }

  key(intent: 'confirm' | 'cancel' | 'undo' | 'redo' | 'choose', index?: number) {
    this.dispatch({ type: 'key', t: performance.now(), intent, ...(index != null ? { index } : {}) });
  }

  command(action: string, args: Record<string, unknown>) {
    this.dispatch({ type: 'command', t: performance.now(), action, args });
  }

  select(ids: string[], mode: 'replace' | 'add' | 'clear' = 'replace') {
    this.dispatch({ type: 'select', t: performance.now(), ids, mode });
  }

  // ------------------------------------------------------------ camera

  async startCamera() {
    await this.vision.start({ hand: true, head: this.settings.headPointer || this.settings.headGestures });
  }

  stopCamera() {
    this.vision.stop();
  }

  private onHand(f: HandFrame | null) {
    this.ui.setState({ hand: f });
    this.hub?.feedHand(f);
    if (f) {
      if (this.handLostTimer) clearTimeout(this.handLostTimer);
      this.handLostTimer = null;
      const g = this.latch.feed(f.pose, performance.now());
      if (g) this.dispatch({ type: 'gesture', t: performance.now(), gesture: g });
    } else if (!this.handLostTimer && this.vision.status === 'running') {
      this.handLostTimer = setTimeout(() => {
        if (this.settings.inputMode === 'hand') this.toast(t('handLost'), 'info');
      }, 2000);
    }
  }

  // ------------------------------------------------------------ settings

  updateSettings(patch: Partial<Settings>) {
    const settings = { ...this.settings, ...patch };
    this.ui.setState({ settings });
    saveSettings(settings);
    if (patch.lang) {
      this.dispatch({ type: 'lang', t: performance.now(), lang: patch.lang });
      this.recognizer.setLang(patch.lang, getPack(patch.lang).bcp47);
      setUiLang(patch.lang);
      void this.recognizer.checkLocal().then((p) => this.ui.setState({ privacy: p }));
    }
    if (patch.inputMode && this.hub) this.hub.mode = patch.inputMode;
    if (patch.voiceFeedback !== undefined) this.voice.enabled = patch.voiceFeedback;
    if (patch.sounds !== undefined) this.cues.enabled = patch.sounds;
    if (patch.proposer !== undefined) this.proposer.enabled = patch.proposer;
    if (patch.smoothing !== undefined) this.applySmoothing();
    if (patch.dwell !== undefined) this.dispatch({ type: 'config', t: performance.now(), patch: { minEvidence: patch.dwell } });
    if (patch.lagMs !== undefined && Math.abs(patch.lagMs - this.state.config.lagMs) > 1)
      this.dispatch({ type: 'calibrate', t: performance.now(), lagMs: patch.lagMs });
    if (patch.alwaysListening !== undefined) {
      this.recognizer.continuous = patch.alwaysListening;
      this.dispatch({ type: 'config', t: performance.now(), patch: { requireWakeWord: patch.alwaysListening } });
      if (patch.alwaysListening) this.recognizer.start();
      else this.recognizer.stop();
    }
    if (patch.headPointer !== undefined || patch.headGestures !== undefined) this.vision.setHead(settings.headPointer || settings.headGestures);
    if (patch.reducedMotion !== undefined && this.stage) this.stage.reducedMotion = patch.reducedMotion;
    for (const fn of this.listeners) fn();
  }

  private applySmoothing() {
    const s = this.settings.smoothing;
    this.hub?.setSmoothing({ minCutoff: 2.2 - s * 1.9, beta: 0.02 - s * 0.015 });
  }

  // ------------------------------------------------------------ replay + Judge Mode

  exportReplay(description = 'Recorded with Hocus Lab'): ReplayFile {
    return {
      version: 1,
      app: this.app.id,
      origin: 'recorded',
      description,
      lang: this.state.lang,
      config: { lagMs: this.state.config.lagMs, minEvidence: this.state.config.minEvidence },
      events: this.log.slice(),
      expected: {
        decisions: this.state.decisions.map((d) => ({
          raw: d.raw,
          outcome: d.outcome,
          ...(d.resolution.status === 'resolved' ? { bindings: d.resolution.bindings as Record<string, unknown> } : {}),
        })),
        finalApp: this.state.doc.app,
      },
    };
  }

  loadReplay(json: unknown) {
    const file = parseReplayFile(json);
    this.state = this.engine.initial({ lang: file.lang, ...(file.config ? { config: file.config as Partial<FusionConfig> } : {}) });
    this.log = [];
    for (const e of file.events) this.dispatch(e as HocusEvent);
    this.scene?.sync(this.state.doc.app, this);
  }

  /** Play a scripted session through the REAL engine and hit-testing, with captions. */
  async playJudge(steps: JudgeStep[]) {
    if (!this.stage || !this.hub) return;
    this.judgeAbort = false;
    const prevMode = this.hub.mode;
    this.hub.mode = 'mouse';
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const el = this.stage.container;
    const fire = (x: number, y: number) => {
      this.scripted = { x, y };
      (el.querySelector('canvas') ?? el).dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, pointerType: 'mouse', bubbles: true }));
    };
    let cur = { x: el.getBoundingClientRect().left + 40, y: el.getBoundingClientRect().bottom - 40 };
    for (let i = 0; i < steps.length && !this.judgeAbort; i++) {
      const s = steps[i]!;
      this.ui.setState({ judge: { playing: true, caption: s.caption, step: i + 1, total: steps.length } });
      if (s.point) {
        const target =
          typeof s.point === 'string'
            ? this.stage.screenOf(s.point)
            : (() => {
                const v = this.stage!.toScreen(new THREE.Vector3(s.point.x, s.point.y, s.point.z));
                return { x: v.x, y: v.y, r: 0 };
              })();
        if (target) {
          const from = cur;
          for (let k = 1; k <= 18 && !this.judgeAbort; k++) {
            const f = k / 18;
            const e = f * f * (3 - 2 * f);
            fire(from.x + (target.x - from.x) * e, from.y + (target.y - from.y) * e);
            await sleep(25);
          }
          cur = { x: target.x, y: target.y };
          for (let k = 0; k < 16 && !this.judgeAbort; k++) {
            fire(cur.x + Math.sin(k) * 1.5, cur.y + Math.cos(k) * 1.5);
            await sleep(30);
          }
        }
      }
      if (s.say && !this.judgeAbort) {
        const lang = this.state.lang;
        const t0 = performance.now();
        this.dispatch({ type: 'speech', speech: { t: t0, kind: 'start', lang } });
        const words = s.say.split(' ');
        for (let w = 1; w <= words.length && !this.judgeAbort; w++) {
          await sleep(140);
          fire(cur.x + Math.sin(w) * 1.2, cur.y);
          const text = words.slice(0, w).join(' ');
          this.ui.setState({ interim: text });
          this.dispatch({ type: 'speech', speech: { t: performance.now(), kind: 'interim', text, lang } });
        }
        await sleep(250);
        this.dispatch({ type: 'speech', speech: { t: performance.now(), kind: 'final', text: s.say, lang } });
        this.ui.setState({ interim: '' });
      }
      await sleep(s.wait ?? 1400);
    }
    this.scripted = null;
    this.hub.mode = prevMode;
    this.ui.setState({ judge: null });
  }

  stopJudge() {
    this.judgeAbort = true;
    this.scripted = null;
    this.ui.setState({ judge: null });
  }
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode */
  }
}
