# Implementation plan: dialogue-manager

- [x] 1. Phase model
  - `Phase`, `Pending`, `Snapshot`, `LastAction`, `CoreState` types; `listening` on speech start
  - _Requirements: 1.1, 1.2_

- [x] 2. Proposal outcomes
  - [x] 2.1 `propose`: preview with locked highlight, sentence and `lock` cue; immediate execute when `previewMs` is 0
    - _Requirements: 1.3_
  - [x] 2.2 Ask with numbered ambiguous highlight and assertive question
    - _Requirements: 1.4_
  - [x] 2.3 `no_target` messages by slot kind; `no_action` record and hint
    - _Requirements: 1.5, 1.6_
  - [x] 2.4 Confirm phase for destructive bulk and `alwaysConfirm`
    - _Requirements: 3.6_

- [x] 3. Timers
  - [x] 3.1 `onTick`: preview executes, ask expires quietly, confirm cancels
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 3.2 Runtime 50 ms tick only while a timer runs
    - _Requirements: 2.5_

- [x] 4. Answers by key, voice and gesture
  - [x] 4.1 `onKey` for keys and gestures; Enter / Esc / 1-9 in `HocusApp.tsx`; buttons in `SpeechBar.tsx`
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 4.2 `chooseOption` with partial bindings; "this one" scored among options; "neither"
    - _Requirements: 3.3, 3.4, 3.5_

- [x] 5. Execution and history
  - [x] 5.1 `execute` with reducer, `mutates`, reply or "Done" announcement, `run` cue
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 5.2 `undo` / `redo` of the whole document, silent phase drop
    - _Requirements: 4.4_
  - [x] 5.3 `__name` execution with unique names
    - _Requirements: 4.5_

- [x] 6. Repair
  - `repair` for "other one" and "not that", exclusions, undo of the executed command, `calibrateLag`
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 7. Calibration, config and language events
  - `calibrate` clamp, `config` through `patchConfig`, `lang` drops the track; runtime stores lag on `calibrated`
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 8. Other entry points
  - [x] 8.1 `pointAction` rewrite of a bare "that one" outside an ask
    - _Requirements: 7.1, 7.2_
  - [x] 8.2 `onCommand` for menus and buttons
    - _Requirements: 7.3_
  - [x] 8.3 "what was that?" from `dwellSegments`
    - _Requirements: 7.4_

- [x] 9. Tests
  - [x]* 9.1 Dialogue examples in `tests/unit/engine.test.ts`
    - _Requirements: 1.3, 1.5, 3.2, 3.3, 3.6, 4.4, 5.2_
  - [x]* 9.2 Property tests P08, P12, P19, P20 (`tests/properties/`)
    - _Requirements: 2.4, 3.6, 4.1, 4.4, 4.5, 5.5_
  - [x]* 9.3 Planet quiz answered by "that one" via `pointAction` (`tests/replays/planets-quiz.replay.json`)
    - _Requirements: 7.1_
  - [x]* 9.4 Unit tests for "not that" with no candidates left and for "what was that?"
    - _Requirements: 5.3, 5.4, 7.4_
  - [x]* 9.5 E2E test of the keyboard-only dialogue (Enter, Esc, 1-9, Ctrl+Z) in a built app (`tests/e2e/`, not written)
    - _Requirements: 3.1, 3.2, 3.3, 4.4_
