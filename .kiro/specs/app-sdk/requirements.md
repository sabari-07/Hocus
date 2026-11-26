# Requirements Document

Spec: app-sdk

## Introduction

The app SDK is how a developer builds an app on the Hocus skeleton. An app supplies a `defineApp` definition
(state, selectables, actions with pure reducers, vocabulary in three languages), a three.js scene and a mount
file. The skeleton supplies everything else: the React shell, the runtime that wires engine, input, speech and
3D together, keyboard and mouse paths, help, settings, onboarding, Judge Mode and kiosk mode. This spec covers
`packages/core/src/app.ts`, `packages/ui`, `tools/create-hocus-app` and `scripts/check-app-size.mjs`.

## Glossary

- **App definition:** the object passed to `defineApp`: `id`, `title`, `initialState`, `selectables`, `actions`, optional `entities`, `vocabulary`, `pointAction`.
- **ActionSpec:** one action: its slots, flags and pure `reduce` function.
- **SlotKind:** the type of value a slot needs: `object`, `objects`, `place`, `entityType`, `factor`, `quantity`, `number`, `color`, `boolean`, `name`.
- **Selectable:** something the user can point at: `id`, `label`, `kind`, `caps`, optional `pos` and `size`.
- **SceneController:** the app's 3D scene object with `sync`, optional `onExecuted`, and `dispose`.
- **HocusRuntime:** the class that owns the engine state, the event log and all adapters.
- **Judge Mode:** a scripted demo that drives the real engine and hit testing with a synthetic mouse and speech.
- **Kiosk mode:** a URL flag for unattended exhibits.

## Requirements

### Requirement 1: The app definition contract

**User Story:** As an app developer, I want to describe my app as data plus pure reducers, so that the skeleton can do the parsing, binding, safety and undo for me.

#### Acceptance Criteria

1. THE SYSTEM SHALL let an app declare `id`, `title`, `initialState`, `selectables(state)`, `actions`, and optionally `entities`, `vocabulary` per language and `pointAction`, through `defineApp`.
2. IF an action is named `undo`, `redo`, `name`, `yes` or `cancel`, THEN `defineApp` SHALL throw an error naming the app and the action.
3. IF an action lists an optional slot that is not declared in its `slots`, THEN `defineApp` SHALL throw an error.
4. THE SYSTEM SHALL support the slot kinds `object`, `objects`, `place`, `entityType`, `factor`, `quantity`, `number`, `color`, `boolean` and `name`, and SHALL convert each binding to a reducer argument with `bindingToArg` (id, id list, `{ x, y, world?, surface? }`, number, or plain value).
5. THE SYSTEM SHALL honour the action options `requires`, `destructive`, `alwaysConfirm`, `distinct`, `mutates`, `defaults`, `optional`, `describe`, `respond`, `examples` and `menuLabel`.
6. THE SYSTEM SHALL change app state only through the action's `reduce(state, args, ctx)`; `defineApp` SHALL return the definition frozen.

### Requirement 2: Shell and runtime

**User Story:** As an app developer, I want one component that gives my app the full Hocus interface, so that my app folder holds only behaviour and visuals.

#### Acceptance Criteria

1. WHEN an app renders `<HocusApp app stage createScene judge links …>`, THE SYSTEM SHALL create one `HocusRuntime`, create a `Stage` in the stage area, call `createScene(stage, runtime)`, attach the pointer hub and start rendering.
2. THE SYSTEM SHALL call `SceneController.sync(state, runtime)` after every document change, `onExecuted(action, args, ids)` for every executed action, and `dispose` on unmount.
3. THE runtime SHALL turn every user input into a `HocusEvent` through `dispatch`, append it to the session log (at most 60,000 events), and apply each engine effect: `announce` to the live regions, `speak` to the voice, `highlight` to the stage, `sound` to the cues, `toast`, `executed` to the scene, `calibrated` to Settings and `decision` to the X-ray selection.
4. THE SYSTEM SHALL keep document state only in the engine; React-only UI state SHALL live in a Zustand store (`runtime.ui`).
5. THE shell SHALL show a top bar (camera, mic, language and offline status; X-ray, Judge Mode, Spellbook and Settings buttons), optional left and right panels (the right panel defaults to the scene list), the speech bar, the Wisp pointer, the lasso trail, toasts and the live regions.
6. THE SYSTEM SHALL set `<html lang>`, `data-theme` (`contrast`), `data-large` and `data-motion` from the settings.

### Requirement 3: Keyboard and mouse parity

**User Story:** As a user who cannot or does not want to use a camera or a microphone, I want every feature through keyboard and mouse, so that Hocus is usable by everyone.

#### Acceptance Criteria

1. THE SYSTEM SHALL list every selectable in the scene list as a button with arrow-key roving focus; click SHALL select and Shift-, Ctrl- or Cmd-click SHALL add to the selection.
2. THE SYSTEM SHALL make everything doable by voice and pointing doable with keyboard and mouse only: voice with pointing, click with a typed command, and the actions menu SHALL produce the same document.
3. WHEN something is selected, THE SYSTEM SHALL show an actions menu with every action whose slots can be filled from the selection (`object`, `objects`, `factor`, `number`, `color`, `boolean`), filtered by the selected object's capability and, for `distinct` actions, by having two selected; it SHALL send `command` events with default values (the action's factor default or 1.25, colour green, boolean true).
4. THE SYSTEM SHALL provide these keys: Space push-to-talk, Enter confirm, Esc cancel (and stop Judge Mode), 1-9 answer, Ctrl+Z / Ctrl+Shift+Z undo / redo, `?` Spellbook, `X` X-ray; while focus is in a text field only Esc SHALL act.
5. THE SYSTEM SHALL announce results in a polite live region and questions in an assertive one.

### Requirement 4: Help, settings, onboarding and landing

**User Story:** As a first-time user, I want to learn what to say and to set Hocus up for my body and device, so that it works for me in under a minute.

#### Acceptance Criteria

1. THE Spellbook SHALL list every action's examples in the current language (English if none) with search and a "Try it" button, the basic phrases for the language with the key map, and the language list with a note that Hindi and Tamil are pending native review.
2. WHEN "Try it" is used while nothing is selected, THE SYSTEM SHALL select the first selectable and then send the example as a typed command.
3. THE Settings drawer SHALL offer input mode, camera on/off, head pointer, sensitivity, dwell (`minEvidence`), lag, recalibrate, language, voice feedback, sounds, always listening, the proposer (with its status), reduced motion, high contrast, large targets, a privacy note and a reset; settings SHALL persist in `localStorage` under `hocus.settings.v1`.
4. THE onboarding dialog SHALL step through language, camera permission (or mouse), pointing at a ghost target, saying "this" to measure the lag, and a first command, and SHALL be skippable at every step.
5. THE landing overlay SHALL offer Start camera, Use mouse, Watch demo and links to the other apps, and SHALL NOT appear when the URL has `?skipLanding`.

### Requirement 5: Judge Mode and kiosk mode

**User Story:** As a judge or a museum visitor, I want a demo that runs itself and an exhibit that resets itself, so that the app can be seen working without setup.

#### Acceptance Criteria

1. WHEN Judge Mode starts, THE SYSTEM SHALL play the app's scripted steps through the real engine and hit testing: move a synthetic mouse to each target (an object's projected centre or a world point), hold it, then emit `start`, one `interim` per word every 140 ms and a `final`, with a caption per step.
2. WHEN the user presses Esc during Judge Mode, THE SYSTEM SHALL stop the script, hide the caption and, once the current wait ends, restore the previous input mode (as it also does when the script finishes).
3. WHERE the URL has `?kiosk` (for example `?kiosk=1`), THE SYSTEM SHALL turn on large targets and, after 2 minutes without pointer or key input outside Judge Mode, undo every change and show the landing overlay.
4. WHERE the build is a dev build or the URL contains `e2e`, THE SYSTEM SHALL expose the runtime as `window.__hocus` for tests.

### Requirement 6: Scaffolder and size budget

**User Story:** As a developer, I want to start a new app in one command and to keep apps small, so that the skeleton stays the place where shared behaviour lives.

#### Acceptance Criteria

1. WHEN a developer runs `create-hocus-app`, THE SYSTEM SHALL create a `defineApp` file, a starter 3D scene and a passing test.
2. THE SYSTEM SHALL count the non-blank, non-comment lines of each app's `src/app.ts` and SHALL fail when `apps/room-designer` or `apps/planet-explorer` exceed 300 lines or `examples/kitchen-board` exceeds 150 lines.
3. THE size check SHALL write `docs/app-size.md` with the behaviour lines, the budget, the screen-design lines (all other `src` files, not budgeted) and the line count of each skeleton package.
4. `npm run lint`, and so `npm run check`, SHALL run the size check.
