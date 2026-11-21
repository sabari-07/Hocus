/**
 * Hocus data contracts. Everything else is built against these shapes.
 * Time is always injected as data (`Millis`); the core never reads a clock.
 */

export type Millis = number;
export type LangCode = 'en' | 'hi' | 'ta';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** One hit-test result computed at capture time (objects may move, so hits are frozen into the sample). */
export interface Hit {
  id: string;
  /** 1 inside the object, fading to 0 at the margin distance. */
  quality: number;
}

/** A point on a pickable surface (floor, wall, table) under the pointer, in world coordinates. */
export interface SurfacePoint {
  surface: string;
  world: Vec3;
}

export type PointerSource = 'hand' | 'head' | 'mouse' | 'touch';
export type PointerPose = 'point' | 'rest' | 'confirm' | 'cancel';

export interface PointerSample {
  t: Millis;
  /** Screen position in CSS pixels. */
  x: number;
  y: number;
  /** Tracker confidence 0..1 (mouse and touch are 1). */
  conf: number;
  source: PointerSource;
  pose: PointerPose;
  /** Thumb-to-index spread relative to hand size, 0..1 (hand only). */
  aperture?: number;
  hits: Hit[];
  place?: SurfacePoint;
}

export type SpeechKind = 'start' | 'interim' | 'final' | 'end' | 'typed';

export interface SpeechEvent {
  t: Millis;
  kind: SpeechKind;
  text?: string;
  lang: LangCode;
  /** Alternative transcripts from the recognizer, best first. */
  alts?: string[];
  /** Voiced segments from voice-activity detection for this utterance, absolute ms. */
  vad?: Array<{ start: Millis; end: Millis }>;
}

export type KeyIntent = 'confirm' | 'cancel' | 'undo' | 'redo' | 'choose';

export type HocusEvent =
  | { type: 'pointer'; sample: PointerSample }
  | { type: 'speech'; speech: SpeechEvent }
  | { type: 'select'; t: Millis; ids: string[]; mode: 'replace' | 'add' | 'clear'; place?: SurfacePoint }
  | { type: 'lasso'; t: Millis; ids: string[] }
  | { type: 'key'; t: Millis; intent: KeyIntent; index?: number }
  | { type: 'gesture'; t: Millis; gesture: 'confirm' | 'cancel' }
  | { type: 'tick'; t: Millis }
  | { type: 'calibrate'; t: Millis; lagMs: number }
  | { type: 'config'; t: Millis; patch: Partial<FusionConfig> }
  | { type: 'lang'; t: Millis; lang: LangCode }
  | { type: 'command'; t: Millis; action: string; args: Record<string, unknown> };

// ---------------------------------------------------------------- selectables

/** What the app says can be pointed at. Derived from app state by `selectables(state)`. */
export interface Selectable {
  id: string;
  label: string;
  kind: string;
  /** Capabilities used for type constraints, e.g. `colorable`, `scalable`, `planet`. */
  caps: string[];
  /** World position and rough size, used for spatial words ("left of that"). */
  pos?: Vec3;
  size?: number;
}

// ---------------------------------------------------------------- parsing

export type DeicticRole = 'object' | 'place' | 'plural' | 'quantity';

export type SlotValue =
  | { type: 'literal'; value: string | number | boolean }
  | {
      type: 'deictic';
      word: string;
      role: DeicticRole;
      order: number;
      tokenIndex: number;
      tWord: Millis;
      /** Languages without a separate "it" (Hindi, Tamil): fall back to discourse memory. */
      alsoAnaphor?: boolean;
    }
  | { type: 'anaphor'; word: string; plural: boolean; order: number; tokenIndex: number; tWord: Millis }
  | { type: 'named'; name: string }
  | { type: 'kind'; kind: string; all: boolean }
  | { type: 'ordinal'; index: number }
  | { type: 'spatial'; relation: SpatialRelation; refs: SlotValue[] };

export type SpatialRelation = 'leftOf' | 'rightOf' | 'nextTo' | 'onTopOf' | 'between' | 'inFrontOf' | 'behind';

export interface CommandFrame {
  action: string;
  slots: Record<string, SlotValue>;
  lang: LangCode;
  raw: string;
  /** Tokens that matched nothing (reported, never acted on). */
  unknown: string[];
}

/** Control utterances are handled by the dialogue manager, not by app reducers. */
export type ControlIntent =
  | { kind: 'yes' }
  | { kind: 'cancel' }
  | { kind: 'undo' }
  | { kind: 'redo' }
  | { kind: 'otherOne' }
  | { kind: 'notThat' }
  | { kind: 'neither' }
  | { kind: 'choose'; index: number }
  | { kind: 'thisOne' }
  | { kind: 'whatWasThat' };

export type ParseResult =
  | { type: 'frame'; frame: CommandFrame }
  | { type: 'control'; intent: ControlIntent; raw: string }
  | { type: 'no_action'; hint: string; raw: string; unknown: string[] };

// ---------------------------------------------------------------- resolution

export type Binding =
  | { kind: 'object'; id: string }
  | { kind: 'objects'; ids: string[] }
  | { kind: 'place'; x: number; y: number; world?: Vec3; surface?: string }
  | { kind: 'quantity'; value: number }
  | { kind: 'value'; value: string | number | boolean };

export interface EvidenceParts {
  /** Sum of timeWeight*dt over hit samples (seconds), before confidence, quality and stability. */
  time: number;
  conf: number;
  quality: number;
  stability: number;
}

export interface CandidateEvidence {
  id: string;
  label: string;
  evidence: number;
  parts: EvidenceParts;
  samples: number;
}

export interface WordResolution {
  slot: string;
  word: string;
  role: DeicticRole | 'anaphor' | 'named' | 'kind' | 'spatial' | 'literal' | 'ordinal';
  tWord?: Millis;
  window?: [Millis, Millis];
  candidates: CandidateEvidence[];
  binding?: Binding;
  via: 'pointing' | 'selection' | 'memory' | 'name' | 'kind' | 'lasso' | 'literal' | 'spatial' | 'none';
}

export type Resolution =
  | { status: 'resolved'; bindings: Record<string, Binding>; confidence: number; words: WordResolution[] }
  | {
      status: 'ask';
      slot: string;
      options: CandidateEvidence[];
      reason: string;
      words: WordResolution[];
      /** Slots already bound before the ambiguous one. */
      partial: Record<string, Binding>;
    }
  | { status: 'no_target'; slot: string; words: WordResolution[] }
  | { status: 'no_action'; hint: string; words: WordResolution[] };

export interface DecisionRecord {
  seq: number;
  t: Millis;
  raw: string;
  lang: LangCode;
  frame?: CommandFrame;
  resolution: Resolution;
  params: FusionConfig;
  /** Pointer samples used (copied) so the X-ray can redraw and re-resolve live. */
  samples: PointerSample[];
  selectables: Selectable[];
  outcome: 'preview' | 'ask' | 'no_target' | 'no_action' | 'confirm' | 'executed' | 'rejected';
  /** Inputs needed to re-resolve exactly (live tuning in the X-ray, `hocus-mcp explain`). */
  context?: {
    typed: boolean;
    tFinal: Millis;
    selection: { ids: string[]; t: Millis; place?: SurfacePoint };
    lasso?: { ids: string[]; t: Millis };
    lastActed: string[];
    exclude: string[];
    names: Record<string, string>;
  };
}

// ---------------------------------------------------------------- config

export interface FusionConfig {
  windowBefore: Millis;
  windowAfter: Millis;
  /** Minimum evidence (weighted seconds) for a binding. */
  minEvidence: number;
  /** Relative margin between best and runner-up below which we ask. */
  margin: number;
  /** Speed (px/ms) at which stability falls to 0.5. */
  stabilitySpeed: number;
  /** Max dt (ms) credited to a single sample (protects against gaps). */
  maxDt: Millis;
  /** Estimated recognizer lag subtracted from interim first-seen times. */
  lagMs: Millis;
  /** Typed-command look-back. */
  typedLookback: Millis;
  previewMs: Millis;
  askTimeoutMs: Millis;
  confirmTimeoutMs: Millis;
  lassoFreshMs: Millis;
  /** Evidence needed for fresh pointing to override discourse memory for "it". */
  itOverrideEvidence: number;
  /** Fraction used by self-calibration to nudge the lag. */
  calibrationRate: number;
  lagMin: Millis;
  lagMax: Millis;
  bufferMs: Millis;
  requireWakeWord: boolean;
  wakeWord: string;
}

// ---------------------------------------------------------------- effects

export type Effect =
  | { type: 'announce'; text: string; politeness: 'polite' | 'assertive' }
  | { type: 'speak'; text: string }
  | { type: 'highlight'; ids: string[]; mode: 'locked' | 'ambiguous' | 'clear' }
  | { type: 'decision'; record: DecisionRecord }
  | { type: 'executed'; action: string; args: Record<string, unknown>; ids: string[] }
  | { type: 'sound'; name: 'lock' | 'run' | 'cancel' | 'ask' | 'error' }
  | { type: 'toast'; text: string; level: 'info' | 'warning' }
  | { type: 'calibrated'; lagMs: number };
