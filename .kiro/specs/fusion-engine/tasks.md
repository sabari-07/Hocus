# Implementation plan: fusion-engine

- [x] 1. Data contracts and validation
  - Write `types.ts` (events, samples with frozen hits, slots, bindings, resolutions, decision records, effects)
  - Write Zod schemas and `validateEvent` that names the bad field
  - _Requirements: 1.1, 1.6_

- [x] 2. Deterministic foundations
  - `DEFAULT_CONFIG` + `patchConfig` clamps, `createRng(seed)`, One Euro filter as pure math
  - `scripts/check-determinism.mjs` bans wall clock, `Math.random`, timers and browser globals in core
  - _Requirements: 1.5_

- [x] 3. Evidence scoring
  - [x] 3.1 `timeWeight`, `stability`, `prepareSamples`, `scoreCandidates`, `decide`
    - _Requirements: 2.2, 2.3, 2.5_
  - [x] 3.2 `dwellSegments` for typed multi-word commands
    - _Requirements: 6.4_
  - [x]* 3.3 Property tests P01, P02, P03, P15, P16
    - _Requirements: 2.1, 2.3, 2.5, 2.6, 4.5_

- [x] 4. Word timing
  - [x] 4.1 `trackInterim` first-seen times; `estimateWordTimes` with position and VAD fallbacks
    - _Requirements: 6.1, 6.2, 6.3_
  - [x]* 4.2 Property test P07 (spoken order)
    - _Requirements: 2.7_

- [x] 5. Resolver
  - [x] 5.1 Object words, anaphors with memory, plurals with lasso, kinds ("every bat"), names
    - _Requirements: 2.1, 3.3, 3.4, 3.6, 4.1, 4.2, 4.3_
  - [x] 5.2 Places, quantities ("this big"), spatial words ("next to this")
    - _Requirements: 3.1, 3.2_
  - [x] 5.3 Type constraints before scoring; implicit "it" for a missing object slot
    - _Requirements: 4.5_
  - [x]* 5.4 Property tests P04, P11, P17
    - _Requirements: 2.4, 3.5, 4.1, 4.2_

- [x] 6. Dialogue manager and safety
  - [x] 6.1 Preview with countdown, cancel/confirm by key, voice and gesture
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 6.2 Ask with numbered options, ordinals, "this one" by pointing; quiet expiry
    - _Requirements: 5.8, 5.9_
  - [x] 6.3 Confirmation for destructive bulk actions; never on timeout
    - _Requirements: 5.5_
  - [x] 6.4 Undo/redo of the whole document (app state + names)
    - _Requirements: 5.4, 4.4_
  - [x] 6.5 Repair: "no, the other one", "not that"; self-calibration of the lag
    - _Requirements: 5.6, 5.7, 6.5, 6.6_
  - [x]* 6.6 Property tests P08, P12, P19, P20
    - _Requirements: 4.4, 5.4, 5.5, 6.5, 6.6_

- [x] 7. Explainability
  - [x] 7.1 `DecisionRecord` with samples, candidates, parts, params and context; keep the last 20
    - _Requirements: 7.1, 7.2_
  - [x] 7.2 `reresolve` / `reresolveRecord` for live tuning
    - _Requirements: 7.3_

- [x] 8. Replay and determinism
  - [x] 8.1 `replay(engine, events)`; replay corpus in `tests/replays/`
    - _Requirements: 1.3, 1.4_
  - [x]* 8.2 Property tests P05, P06, P18
    - _Requirements: 1.3, 1.4, 1.6_

- [x] 9. Mutation checks
  - `scripts/sanity-mutants.mjs` (hand-picked) and `stryker.config.json` (full)
  - _Requirements: all_
