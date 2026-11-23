# Implementation plan: room-designer

- [x] 1. Room model (`apps/room-designer/src/app.ts`)
  - [x] 1.1 `Item`, `Room`, `CATALOG` (14 types), `TYPES`
    - _Requirements: 1.1, 1.2_
  - [x] 1.2 `make`, `snap`, `placeFromArg`, `update` helpers
    - _Requirements: 1.5, 2.1_
  - [x] 1.3 `STARTERS` (crypt, parlor, graveyard); crypt is the initial state
    - _Requirements: 1.3_
  - [x] 1.4 Selectables with labels, caps, position and size
    - _Requirements: 1.4_

- [x] 2. Actions
  - [x] 2.1 `place`, `move`
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 2.2 `scale`, `resize`, `rotate`, `recolor`, `duplicate`, `front`, `back`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  - [x] 2.3 `delete` (destructive), `lights`, `describe` (no undo step), `reset` (always confirm)
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 3. Vocabulary and examples
  - Nouns for all 14 types and the `lights` verb in en, hi, ta; examples for every action
  - _Requirements: 5.1, 5.2_

- [x] 4. 3D scene (`scene.ts`, `models.ts`)
  - [x] 4.1 Room shell, floor and wall surfaces, lights, motes
    - _Requirements: 6.1_
  - [x] 4.2 `buildProp` procedural models with tintable and glow materials
    - _Requirements: 4.2, 6.2_
  - [x] 4.3 `sync` (add, update, remove), easing, tints; `onExecuted` bursts; reduced motion
    - _Requirements: 6.2, 6.3_

- [x] 5. Mount (`main.tsx`)
  - [x] 5.1 Crypt palette, "Start over", nudge buttons, lights toggle, scene list
    - _Requirements: 2.4, 2.5, 4.4_
  - [x] 5.2 "Export PNG" and the 8-step Judge Mode script
    - _Requirements: 6.4, 6.5_
  - [x] 5.3 Command or button to load the parlor and graveyard starters
    - _Requirements: 1.3_

- [x] 6. Checks
  - [x]* 6.1 App lint, examples and unique selectables (`tests/unit/apps.test.ts`)
    - _Requirements: 5.1, 5.2, 5.3_
  - [x]* 6.2 Replays `room-bigger-put-there` and `room-name-and-repair` (`tests/replays/replays.test.ts`)
    - _Requirements: 2.2, 3.1, 3.4_
  - [x] 6.3 Size budget (`npm run app-size`)
    - _Requirements: 6.6_
  - [x]* 6.4 Replay with a real "no, the other one" repair in the room
    - _Requirements: 3.4_
  - [x]* 6.5 E2E + axe run of the built app with mouse and typed commands (`tests/e2e/`, not written)
    - _Requirements: 2.4, 3.1_
