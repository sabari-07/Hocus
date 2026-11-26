# Requirements Document

Spec: pointer-input

## Introduction

Pointer input turns a hand, a head, a mouse or a finger on a touch screen into one stream of timestamped
`PointerSample` events. Each sample carries the objects under the pointer at the moment it was captured, so the
fusion engine never has to hit-test later. Pointer input also produces clicks, taps and lasso selections.
It spans `packages/input` (hub and mapping), `packages/core` (One Euro filter and lasso geometry, pure and
tested), `packages/vision` (MediaPipe trackers and pose rules) and the hit testing in `packages/three/src/stage.ts`.

## Glossary

- **PointerSample:** `{ t, x, y, conf, source, pose, hits, place?, aperture? }` in screen (CSS px) coordinates.
- **Hit / hit quality:** an object id with a quality in (0, 1]; 1 means the camera ray hits the object.
- **Pose:** `point`, `rest`, `confirm` (thumbs-up) or `cancel` (open palm).
- **Aperture:** the thumb-to-index spread, 0 to 1, used for "make it this big".
- **Virtual touchpad:** the middle part of the camera frame, mirrored and stretched to the stage.
- **One Euro filter:** a speed-adaptive low-pass filter: steady when slow, responsive when fast.
- **Lasso:** a closed loop drawn with shift-drag or in the air that selects several objects.

## Requirements

### Requirement 1: One pointer stream from several sources

**User Story:** As a user, I want to point with whatever I have (hand, head, mouse or touch), so that Hocus works on my device and with my body.

#### Acceptance Criteria

1. THE SYSTEM SHALL emit one `pointer` event per tick (30 Hz by default) with `t, x, y, conf, source, pose, hits`, plus `place` and `aperture` when known.
2. WHILE the input mode is `auto`, THE SYSTEM SHALL use a hand frame younger than 500 ms first, then a head frame younger than 500 ms, then touch, then the mouse.
3. WHILE the input mode is `hand` or `head` and that tracker has no fresh frame, THE SYSTEM SHALL fall back to the mouse.
4. WHEN the mouse leaves the stage, THE SYSTEM SHALL report mouse samples with pose `rest`.
5. WHEN no source is available, THE SYSTEM SHALL stop emitting samples and mark the pointer view inactive.

### Requirement 2: Camera mapping and smoothing

**User Story:** As a hand or head pointer user, I want a steady pointer that still follows quick moves, so that I can hold it on small targets.

#### Acceptance Criteria

1. THE SYSTEM SHALL map camera-normalized hand coordinates to the stage with a mirrored virtual touchpad that stretches the middle `pad` fraction (default 0.6) of the camera frame to the stage and clamps to its edges.
2. THE SYSTEM SHALL map head coordinates with a 0.25 pad over the window, so that small head turns cover the screen.
3. THE SYSTEM SHALL smooth hand and head positions with a One Euro filter whose output never overshoots the range of the inputs seen so far.
4. WHEN a tracker loses the hand or the face, THE SYSTEM SHALL reset that source's filter.
5. WHEN the user sets the sensitivity `s` (0 to 1) in Settings, THE SYSTEM SHALL set the hand filter to `minCutoff = 2.2 − 1.9 s` and `beta = 0.02 − 0.015 s`.
6. WHERE a four-corner homography has been set with `setCalibration`, THE SYSTEM SHALL map hand coordinates through it instead of the touchpad.

### Requirement 3: Hit testing at capture time

**User Story:** As a user pointing at moving planets, I want Hocus to remember what was under my finger at that moment, so that "that" means what I saw.

#### Acceptance Criteria

1. WHEN a sample with pose `point` is captured, THE SYSTEM SHALL hit-test at that moment and store the hits on the sample; samples with any other pose SHALL carry no hits.
2. THE SYSTEM SHALL give the object under the camera ray quality 1, and any other visible object 0.9 inside 80% of its projected radius, falling linearly to 0 over a margin of `max(stage margin, min(36 px, 0.35 × radius))`; hits of quality 0.02 or less SHALL be dropped.
3. WHEN the ray also hits a registered surface, THE SYSTEM SHALL attach the surface name and world point as `place`.
4. WHEN the point is outside the canvas, THE SYSTEM SHALL return no hits.
5. THE SYSTEM SHALL ignore invisible objects and objects behind the camera.

### Requirement 4: Clicks, taps and lasso

**User Story:** As a mouse, touch or hand user, I want to select one thing by clicking and several things by drawing a loop, so that "these" and the actions menu have something to act on.

#### Acceptance Criteria

1. WHEN a press and release are within 8 px and 600 ms, THE SYSTEM SHALL emit `select` for the top hit if its quality is at least 0.5 (Shift adds to the selection), or otherwise `select` with mode `clear` and the surface `place`.
2. WHEN the user shift-drags with the mouse and releases after more than 6 points, THE SYSTEM SHALL emit `lasso` with every object whose projected rectangle is at least 60% inside the loop, and SHALL emit nothing if no object qualifies.
3. WHILE the hand points, THE SYSTEM SHALL keep a 2.5 s trail and, WHEN the newest point comes back within 45 px of a point at least 500 ms older with at least 300 px of path in between, treat that part of the trail as a lasso loop.
4. THE SYSTEM SHALL estimate the area inside the loop on a deterministic 7 × 7 grid and SHALL project each object's 3D bounding box corners to a screen rectangle for this test.
5. WHEN a lasso loop is closed, THE SYSTEM SHALL show the loop for 700 ms.

### Requirement 5: Hand and head tracking on the device

**User Story:** As a user, I want touchless pointing that keeps my camera image private, so that I can use Hocus with messy hands or in a kiosk.

#### Acceptance Criteria

1. WHEN the camera is started, THE SYSTEM SHALL open a 640 × 480 front camera stream and run MediaPipe GestureRecognizer for one hand from self-hosted model and WASM files, trying the GPU delegate first and the CPU delegate if that fails.
2. WHERE head pointing is enabled, THE SYSTEM SHALL also run FaceLandmarker and use the nose landmark as the head pointer with confidence 0.9.
3. THE SYSTEM SHALL process at most one new video frame every 30 ms and SHALL NOT send camera frames off the device.
4. IF camera permission is denied or there is no camera, THEN THE SYSTEM SHALL set the status `denied` or `no-camera` and show a toast while the mouse keeps working; IF the models fail to load, THEN the status SHALL be `error`.
5. THE SYSTEM SHALL use the index fingertip as the pointer anchor and the handedness score, clamped to [0.3, 1], as confidence.

### Requirement 6: Poses, gestures and aperture

**User Story:** As a camera user, I want thumbs-up and open palm to confirm and cancel, and my finger spread to show a size, so that I never need the keyboard.

#### Acceptance Criteria

1. WHEN the built-in gesture score is above 0.6, THE SYSTEM SHALL classify `Thumb_Up` as `confirm`, `Open_Palm` as `cancel` and `Pointing_Up` as `point`.
2. OTHERWISE THE SYSTEM SHALL classify `point` when the index finger is extended (tip-to-wrist distance above 1.15 × PIP-to-wrist distance) and the ring and pinky fingers are not, and `rest` in every other case.
3. THE SYSTEM SHALL compute aperture as the thumb-tip-to-index-tip distance divided by the wrist-to-middle-knuckle distance, mapped by `(spread − 0.15) / 1.35` and clamped to [0, 1].
4. WHEN a `confirm` or `cancel` pose is held for 450 ms, THE SYSTEM SHALL emit exactly one `gesture` event, and SHALL emit another only after the pose has changed.
5. WHEN the hand is lost for 2 s while the input mode is `hand`, THE SYSTEM SHALL show a "hand lost" toast.

### Requirement 7: Head gestures

**User Story:** As a user who cannot use my hands, I want to nod to confirm and shake my head to cancel, so that I can finish a command without touching anything.

#### Acceptance Criteria

1. WHEN the nose path of the last 1.3 s holds at least three alternating vertical swings of at least 1.6% of the camera frame, and the horizontal movement is under 65% of the vertical movement, THE SYSTEM SHALL report a nod, which the runtime sends as a `confirm` gesture.
2. WHEN it holds at least three alternating horizontal swings under the same rule, THE SYSTEM SHALL report a shake, which the runtime sends as a `cancel` gesture.
3. WHEN the head moves steadily in one direction (head pointing), THE SYSTEM SHALL NOT report a gesture.
4. WHEN a head gesture fires, THE SYSTEM SHALL clear the nose history and ignore further head gestures for 1.8 s.
5. WHERE head gestures are enabled and head pointing is not, THE SYSTEM SHALL run face tracking without moving the pointer.
