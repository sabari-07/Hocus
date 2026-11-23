# Implementation plan: hocus-lab

- [x] 1. X-ray decision view (`packages/devtools/src/XRay.tsx`)
  - [x] 1.1 Lanes: pointer segments, word windows and times, candidate evidence with `minEvidence` line
    - _Requirements: 1.1_
  - [x] 1.2 History of the last 6 decisions; scrub with nearest-sample readout
    - _Requirements: 1.2, 1.3_
  - [x] 1.3 Live tuning through `engine.reresolve`, lag shift for spoken commands, reset
    - _Requirements: 1.4, 1.5_
  - [x] 1.4 `summarize` text for `aria-label` and live region (`summary.ts`)
    - _Requirements: 1.6_

- [x] 2. Recorder (`packages/ui/src/runtime.ts`, `HocusApp.tsx`)
  - [x] 2.1 Session log with 60,000-event cap; Recorder tab with count
    - _Requirements: 2.1_
  - [x] 2.2 `exportReplay` (origin `recorded`, expected block) and file download
    - _Requirements: 2.2_
  - [x] 2.3 `loadReplay` with `parseReplayFile`
    - _Requirements: 2.3, 2.5_
  - [x] 2.4 Apply the file's `config` in `loadReplay` and show an error when a file is invalid
    - _Requirements: 2.3, 2.5_
  - [x] 2.5 "Copy test" with `testSnippet`
    - _Requirements: 2.4_
  - [x] 2.6 Make `testSnippet` paths match the exported file name and the `examples/` folder
    - _Requirements: 2.4_

- [x] 3. Replay corpus
  - [x] 3.1 `ReplayFileSchema` / `parseReplayFile` (`packages/core/src/schemas.ts`)
    - _Requirements: 3.1_
  - [x] 3.2 `scripts/generate-replays.ts` (six synthetic sessions, never overwrites recorded files)
    - _Requirements: 3.4, 3.5_
  - [x]* 3.3 `tests/replays/replays.test.ts` over every file, for all three apps
    - _Requirements: 3.2, 3.3_
  - [x]* 3.4 MCP replay tool test (`tests/unit/mcp.test.ts`)
    - _Requirements: 3.6_
  - [ ] 3.5 Commit at least one recorded session (origin `recorded`) from a real camera and microphone run
    - _Requirements: 3.1, 3.5_
  - [x] 3.6 Add the "no, the other one" step that `room-name-and-repair` describes
    - _Requirements: 3.2_

- [x] 4. Timeline simulator (`packages/devtools/src/Simulator.tsx`)
  - Segments, utterance, first word time, `resolveFrame` with `DEFAULT_CONFIG`, summary
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 5. Lab lives inside every app as the X-ray sheet (Decision, Timeline simulator, Recorder tabs); the standalone `dev:lab` script was removed instead of adding a fourth front end
  - _Requirements: 1.1, 4.1_
