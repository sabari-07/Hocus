# Implementation plan: pointer-input

- [x] 1. Pure math in core
  - [x] 1.1 One Euro filter: `oneEuroInit`, `oneEuroStep`, `OneEuro2D` (`packages/core/src/smoothing.ts`)
    - _Requirements: 2.3, 2.4_
  - [x] 1.2 Lasso geometry: `pointInPolygon`, `rectFractionInPolygon`, `selectInLoop`, `detectLoop` (`packages/core/src/geometry.ts`)
    - _Requirements: 4.2, 4.3, 4.4_

- [x] 2. Camera-to-screen mapping
  - [x] 2.1 `touchpadMap` with mirror and pad fraction
    - _Requirements: 2.1, 2.2_
  - [x] 2.2 `solveHomography`, `applyHomography`, `PointerHub.setCalibration`
    - _Requirements: 2.6_
  - [ ] 2.3 Four-corner calibration UI that collects points and calls `solveHomography` + `setCalibration`
    - _Requirements: 2.6_

- [x] 3. Pointer hub (`packages/input/src/hub.ts`)
  - [x] 3.1 Sources and modes (`feedHand`, `feedHead`, mouse and touch listeners, `pick`)
    - _Requirements: 1.2, 1.3, 1.4, 1.5_
  - [x] 3.2 Fixed-rate `tick` that emits samples with hits captured at that moment
    - _Requirements: 1.1, 3.1_
  - [x] 3.3 Click and tap become `select` events
    - _Requirements: 4.1_
  - [x] 3.4 Shift-drag lasso and hand-drawn loop, 700 ms trail
    - _Requirements: 4.2, 4.3, 4.5_
  - [x] 3.5 Sensitivity setting drives the hand filter (`setSmoothing`, `HocusRuntime.applySmoothing`)
    - _Requirements: 2.5_
  - [ ] 3.6 Pause camera pointing while the user types (the `paused` flag exists but nothing sets it)
    - _Requirements: 1.2_

- [x] 4. Stage hit testing (`packages/three/src/stage.ts`)
  - `hitTest` with ray hit, forgiving margin and surfaces; `screenOf`; `projectRects`; `toScreen`
  - _Requirements: 3.2, 3.3, 3.4, 3.5, 4.4_

- [x] 5. Vision trackers (`packages/vision/src/trackers.ts`)
  - [x] 5.1 `VisionTracker.start`: camera, self-hosted WASM and models, GPU then CPU, status values
    - _Requirements: 5.1, 5.3, 5.4_
  - [x] 5.2 Head pointer with FaceLandmarker (`setHead`)
    - _Requirements: 5.2_
  - [x] 5.3 Runtime wiring: camera toasts, hand-lost toast after 2 s
    - _Requirements: 5.4, 6.5_

- [x] 6. Poses and gestures
  - [x] 6.1 `classifyPose`, `aperture`, `pointerAnchor` (`packages/vision/src/pose.ts`)
    - _Requirements: 5.5, 6.1, 6.2, 6.3_
  - [x] 6.2 `GestureLatch` (450 ms hold, fires once) and `gesture` events from `HocusRuntime.onHand`
    - _Requirements: 6.4_

- [ ] 7. Tests
  - [x]* 7.1 Property test P09 (`tests/properties/P09-smoothing-bounds.prop.test.ts`)
    - _Requirements: 2.3_
  - [x]* 7.2 Property test P17 (`tests/properties/P17-lasso.prop.test.ts`)
    - _Requirements: 4.2, 4.4_
  - [ ]* 7.3 Unit tests for `classifyPose` and `aperture` (`tests/unit/vision-pose.test.ts`, referenced in `pose.ts`, not written)
    - _Requirements: 6.1, 6.2, 6.3_
  - [ ]* 7.4 Unit tests for `touchpadMap` clamping and a `solveHomography` round trip
    - _Requirements: 2.1, 2.6_
  - [ ]* 7.5 E2E test: mouse pointing and clicks on the built apps (`tests/e2e/`, not written)
    - _Requirements: 1.2, 4.1_
