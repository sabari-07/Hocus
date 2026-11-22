# Architecture

## The idea in one picture

```mermaid
flowchart LR
  subgraph Adapters["Adapters (browser)"]
    CAM[Camera → MediaPipe hand/face<br/>@hocus/vision] --> HUB
    MOUSE[Mouse / touch / clicks] --> HUB
    HUB[PointerHub @hocus/input<br/>One Euro, hit test at capture,<br/>lasso, 30 Hz samples]
    MIC[Web Speech + VAD<br/>@hocus/speech] --> SPE[SpeechEvents]
    KEYS[Keyboard / typed box / actions menu] --> CMD[key, typed, command events]
  end
  HUB -->|pointer| LOG[(Event log)]
  SPE -->|speech| LOG
  CMD --> LOG
  LOG --> STEP["engine.step(state, event)<br/>@hocus/core — pure"]
  STEP --> FX[Effects: announce, speak,<br/>highlight, sound, executed, decision]
  FX --> UI[@hocus/ui shell<br/>speech bar, Wisp, chips, ask, toasts]
  FX --> STAGE[@hocus/three Stage<br/>outlines, badges]
  STEP --> DOC[Doc: app state + names<br/>undo / redo]
  DOC --> SCENE[App scene.ts<br/>three.js visuals]
  LOG --> XRAY[Hocus Lab X-ray, replay, export]
  LOG --> TESTS[Property tests, replay corpus,<br/>benchmark, hocus-mcp]
```

Everything the user does becomes a timestamped `HocusEvent`. The core folds events with a pure function and
returns effects. The same log drives the live app, the X-ray view, replay files, the benchmark, the MCP server and
the property tests.

## Packages

| Package | Lines (see `docs/app-size.md`) | Job |
|---|---|---|
| `@hocus/core` | the brain | parser, timing, evidence, resolver, dialogue, safety, undo, names, replay, schemas, lexicon packs |
| `@hocus/input` | pointing | pointer hub, mouse/touch, virtual touchpad and four-corner homography, lasso |
| `@hocus/vision` | camera | MediaPipe GestureRecognizer (hand) and FaceLandmarker (head), pose and aperture |
| `@hocus/speech` | voice | push-to-talk recognizer, VAD, read-back, sound cues, optional on-device proposer |
| `@hocus/three` | 3D | Stage: renderer, bloom, outlines, CSS2D chips, selectable registry, screen-space hit test, surfaces |
| `@hocus/ui` | shell | `HocusApp`, `HocusRuntime`, speech bar, Wisp, Spellbook, Settings, onboarding, landing, Judge Mode, kiosk |
| `@hocus/devtools` | Hocus Lab | X-ray (lanes, scrubber, live tuning), timeline simulator, recorder |
| `@hocus/testkit` | tests | test app, arbitraries, simulated users |

## The app contract

An app provides four things; the skeleton supplies the rest.

```ts
export const roomApp = defineApp<Room>({
  id: 'room-designer',
  initialState,
  selectables: (s) => s.items.map((i) => ({ id: i.id, label: `Pumpkin ${i.n}`, kind: i.type, caps: ['scalable', 'colorable'] })),
  actions: {
    scale: { slots: { target: 'object', factor: 'factor' }, defaults: { factor: 1.25 }, requires: 'scalable',
             reduce: (s, a) => update(s, a.target, (i) => ({ ...i, scale: i.scale * a.factor })) },
    // ...
  },
  vocabulary: { en: { nouns: { pumpkin: ['pumpkin', 'pumpkins'] } }, hi: { ... }, ta: { ... } },
});
```

plus a `createScene(stage, runtime)` that builds three.js objects and calls `stage.register(id, object3D)`.

## Why hits are frozen into samples

Planets orbit and ghosts bob. If the resolver re-hit-tested at decision time it would ask "what is under the
finger *now*", which is the bug Hocus exists to avoid. The hub hit-tests each sample when it is captured, so
`samples[i].hits` records what was under the pointer at `t_i`.

## Timing model

`tWord = firstInterimContaining(word_k) − lag`, refined by token position and our own VAD when present.
`lag` defaults to 350 ms, is measured during onboarding (interim time − VAD speech onset), and is nudged by
"no, the other one" (self-calibration). Typed commands use the Enter time with a 1.5 s look-back.

## Privacy

- Camera frames are processed by MediaPipe WASM in the page. No frame is stored or sent anywhere.
- Speech uses the browser's recognizer. In Chrome that is a cloud service unless on-device recognition is
  available (`processLocally`); the Settings drawer says which one is active.
- No analytics. Settings live in `localStorage`. The PWA caches the model and WASM files so the app runs offline
  after the first load (speech may still need the network).
