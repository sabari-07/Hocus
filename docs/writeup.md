# How Kiro was used (draft for the submission form)

> Edit before submitting. Keep only what you actually did; the sections marked **(you)** need your own words.

## The problem we gave Kiro

Binding "that" to the object a person was pointing at *when they said it* is a timing problem with noise and
ambiguity. AI-written code tends to fail it in predictable ways: it samples the pointer "now", reads the wall clock
inside logic, and guesses when two objects are close. The Kiro setup was designed around stopping exactly those
mistakes.

## Specs (Kiro IDE)

- `.kiro/specs/fusion-engine/` was written **before** the core code: EARS requirements (7 requirements, 42
  criteria after the live-preview additions), a design with every parameter, and a correctness-property table (P01–P20) that maps each property to
  requirement ids. Property test titles cite those ids.
- All 30 spec files (10 specs × requirements, design, tasks) pass Kiro's own `validate_spec_format`. A first run of the validator rejected every file; a sub-agent normalised them without changing requirement ids.
- Nine more specs (`lexicon-parser`, `pointer-input`, `speech-input`, `dialogue-manager`, `app-sdk`,
  `room-designer`, `planet-explorer`, `hocus-lab`, `kitchen-board`). A sub-agent wrote them from the code and listed
  every gap between plan and code; the gaps were fixed or left as unchecked tasks (see `docs/kiro-journal.md`).
- **(you)** Spec-driven vs vibe coding: what you noticed.

## Steering

Eight files. The two that changed Kiro's output most:

- `fusion-rules.md` (`fileMatch` on the core): no wall clock or randomness, windowed evidence around the word time,
  never guess, every decision produces a record. `scripts/check-determinism.mjs` and a hook enforce it.
- `testing.md`: one property per file, shrinkable arbitraries from `@hocus/testkit`, run counts from `FC_RUNS`,
  never relabel synthetic replays as recorded.
- A rule added mid-build after a real bug: Windows PowerShell corrupts UTF-8 text (`tech.md`).

## Hooks (`.kiro/hooks/*.json`, IDE 1.0 format)

| Hook | Trigger | What it does |
|---|---|---|
| core-determinism | save in `packages/core/src` | fails on `Date.now`, `Math.random`, timers, DOM |
| core-fast-properties | save in core, testkit or properties | P01–P20 with 50 cases (~5 s) |
| lexicon-lint | lexicon pack or `app.ts` | en/hi/ta gaps and collisions + parser/app tests |
| new-replay-regression | new `*.replay.json` | replay suite |
| ui-a11y-smoke | UI `.tsx`/`.css` | Playwright + axe smoke |
| requirements-changed | `requirements.md` | agent: re-run Analyze Requirements, check citations, log it |
| new-action-parity | `app.ts` | agent: examples in 3 languages, keyboard path, destructive flags |
| turn-end-gate | agent stops | lint + typecheck + unit tests |

## Custom agents (`.kiro/agents/`)

`fusion-reviewer` (read-only, can call `hocus-mcp`), `a11y-auditor` (can only run Playwright/Vitest),
`linguist-reviewer` (read-only, lints packs through MCP).

## MCP

- `tools/hocus-mcp`: Kiro can call `resolve` with a described dwell timeline, `replay`, `explain` and
  `lint_lexicon` against the **real** engine while it builds, instead of reasoning about timing in its head.
  Tested over stdio in `tests/unit/mcp.test.ts`.
- Context7 (library docs) and Playwright MCP (browser automation) in `docs/mcp.example.json`.

## Property-based testing

- 22 properties (27 tests), 100 cases each on every run, 5,000 nightly. P21 guards the live preview; P22 guards the head-gesture classifier.
- All passed on the first run, so we proved they can fail: `scripts/sanity-mutants.mjs` breaks seven rules one at
  a time and each named property catches its mutant. One mutant first **survived** (removing the type constraint),
  which exposed a missing property; it was added to P15.
- Stryker mutation score for the fusion math: `docs/mutation.md`.

## Live explanation and head gestures (added after review)

- Requirements 7.4 to 7.6 of the fusion-engine spec added `engine.preview` and `engine.liveEvidence`: pure functions that
  say what a partial transcript would bind to. The UI draws them as a ghost command, evidence glow and spell threads.
  Property P21 checks that a preview never changes state and that a typed command resolves exactly as previewed.
- Requirement 7 of the pointer-input spec added nod = confirm and shake = cancel (`detectHeadGesture`, property P22).

## Powers and Crew

- `power/`: `plugin.json`, `mcp.json`, and the `build-hocus-app` skill.
- `crew/hocus-soak-tester/`: a Crew app with a nightly cron that runs the properties with a date seed and reports
  counterexamples. Publish it as its own repo for the Crew bonus.

## Kiro surfaces

- **IDE:** specs, steering, hooks, agents, property tests and all implementation.
- **(you)** CLI / Web / Crew: describe only what you actually ran.

## Results you can verify

`npm run check`, `npm run test:e2e`, `npm run bench`, `npm run app-size`, `node scripts/sanity-mutants.mjs`.
