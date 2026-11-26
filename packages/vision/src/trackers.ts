import { FaceLandmarker, FilesetResolver, GestureRecognizer, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { TrackerFrame } from '@hocus/input';
import { aperture, classifyPose, detectHeadGesture, pointerAnchor, type NoseSample } from './pose.ts';

export interface VisionPaths {
  /** Folder with vision_wasm_internal.{js,wasm} (self-hosted). */
  wasm: string;
  gestureModel: string;
  faceModel: string;
}

export const DEFAULT_PATHS: VisionPaths = {
  wasm: `${import.meta.env?.BASE_URL ?? '/'}wasm`,
  gestureModel: `${import.meta.env?.BASE_URL ?? '/'}models/gesture_recognizer.task`,
  faceModel: `${import.meta.env?.BASE_URL ?? '/'}models/face_landmarker.task`,
};

export type VisionStatus = 'off' | 'loading' | 'running' | 'denied' | 'error' | 'no-camera';

export interface HandFrame extends TrackerFrame {
  landmarks: NormalizedLandmark[];
  gesture?: string;
}

/**
 * On-device hand + face tracking. Camera frames never leave the browser:
 * MediaPipe runs as WASM (GPU delegate with CPU fallback) on a local <video>.
 */
export class VisionTracker {
  status: VisionStatus = 'off';
  video: HTMLVideoElement;
  private gesture: GestureRecognizer | null = null;
  private face: FaceLandmarker | null = null;
  private stream: MediaStream | null = null;
  private raf = 0;
  private lastVideoTime = -1;
  private lastRun = 0;
  private wantFace = false;
  private statusCbs = new Set<(s: VisionStatus, detail?: string) => void>();
  onHand: (f: HandFrame | null) => void = () => {};
  onHead: (f: TrackerFrame | null) => void = () => {};
  /** A nod means confirm, a shake means cancel. */
  onHeadGesture: (g: 'confirm' | 'cancel') => void = () => {};
  private nosePath: NoseSample[] = [];
  private lastHeadGesture = 0;
  fps = 0;
  private frames = 0;
  private fpsT = 0;

  constructor(private paths: VisionPaths = DEFAULT_PATHS) {
    this.video = document.createElement('video');
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.setAttribute('aria-hidden', 'true');
  }

  onStatus(fn: (s: VisionStatus, detail?: string) => void) {
    this.statusCbs.add(fn);
    return () => this.statusCbs.delete(fn);
  }

  private set(s: VisionStatus, detail?: string) {
    this.status = s;
    for (const fn of this.statusCbs) fn(s, detail);
  }

  async start(opts: { hand?: boolean; head?: boolean } = { hand: true }) {
    this.wantFace = !!opts.head;
    if (this.status === 'running' || this.status === 'loading') {
      if (this.wantFace && !this.face) await this.loadFace();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) return this.set('no-camera', 'This browser has no camera API.');
    this.set('loading');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
    } catch (e) {
      const name = (e as DOMException).name;
      return this.set(name === 'NotAllowedError' ? 'denied' : 'no-camera', String((e as Error).message));
    }
    this.video.srcObject = this.stream;
    await this.video.play().catch(() => {});
    try {
      const fileset = await FilesetResolver.forVisionTasks(this.paths.wasm);
      const make = (delegate: 'GPU' | 'CPU') =>
        GestureRecognizer.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: this.paths.gestureModel, delegate },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      this.gesture = await make('GPU').catch(() => make('CPU'));
      if (opts.head || this.wantFace) await this.loadFace(fileset);
    } catch (e) {
      return this.set('error', String((e as Error).message));
    }
    this.set('running');
    this.loop();
  }

  private async loadFace(fileset?: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>) {
    const fs = fileset ?? (await FilesetResolver.forVisionTasks(this.paths.wasm));
    const make = (delegate: 'GPU' | 'CPU') =>
      FaceLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: this.paths.faceModel, delegate }, runningMode: 'VIDEO', numFaces: 1 });
    this.face = await make('GPU').catch(() => make('CPU'));
  }

  setHead(on: boolean) {
    this.wantFace = on;
    if (on && !this.face && this.status === 'running') void this.loadFace();
    if (!on) this.onHead(null);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.gesture?.close();
    this.face?.close();
    this.gesture = null;
    this.face = null;
    this.onHand(null);
    this.onHead(null);
    this.set('off');
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    // ~30 fps is enough and keeps laptops cool.
    if (now - this.lastRun < 30 || this.video.readyState < 2 || this.video.currentTime === this.lastVideoTime) return;
    this.lastRun = now;
    this.lastVideoTime = this.video.currentTime;
    this.frames++;
    if (now - this.fpsT > 1000) {
      this.fps = this.frames;
      this.frames = 0;
      this.fpsT = now;
    }
    if (this.gesture) {
      const r = this.gesture.recognizeForVideo(this.video, now);
      const lm = r.landmarks[0];
      if (lm) {
        const g = r.gestures[0]?.[0];
        const anchor = pointerAnchor(lm)!;
        const conf = r.handedness[0]?.[0]?.score ?? 0.8;
        const ap = aperture(lm);
        this.onHand({
          nx: anchor.x,
          ny: anchor.y,
          conf: Math.min(1, Math.max(0.3, conf)),
          pose: classifyPose(lm, g && g.score > 0.6 ? g.categoryName : undefined),
          ...(ap != null ? { aperture: ap } : {}),
          landmarks: lm,
          ...(g ? { gesture: g.categoryName } : {}),
        });
      } else this.onHand(null);
    }
    if (this.face && this.wantFace) {
      const r = this.face.detectForVideo(this.video, now);
      const nose = r.faceLandmarks[0]?.[1];
      if (nose) {
        this.onHead({ nx: nose.x, ny: nose.y, conf: 0.9, pose: 'point' });
        this.nosePath.push({ t: now, x: nose.x, y: nose.y });
        if (this.nosePath.length > 60) this.nosePath.shift();
        if (now - this.lastHeadGesture > 1800) {
          const g = detectHeadGesture(this.nosePath);
          if (g) {
            this.lastHeadGesture = now;
            this.nosePath = [];
            this.onHeadGesture(g === 'nod' ? 'confirm' : 'cancel');
          }
        }
      } else {
        this.onHead(null);
        this.nosePath = [];
      }
    }
  };
}

/** Debounce held gestures (thumbs-up = confirm, open palm = cancel) into single events. */
export class GestureLatch {
  private since = 0;
  private current: string | null = null;
  private fired = false;
  constructor(private holdMs = 450) {}
  feed(pose: string, t: number): 'confirm' | 'cancel' | null {
    if (pose !== this.current) {
      this.current = pose;
      this.since = t;
      this.fired = false;
      return null;
    }
    if (!this.fired && t - this.since >= this.holdMs && (pose === 'confirm' || pose === 'cancel')) {
      this.fired = true;
      return pose;
    }
    return null;
  }
}
