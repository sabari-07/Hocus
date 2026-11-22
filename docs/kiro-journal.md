# Kiro journal

What Kiro got wrong, what caught it, and what changed. Entries are in build order. Everything here happened in
this repository; nothing is staged.

## Setup

- **Format facts first.** Before writing `.kiro/`, Kiro asked its `introspect` sub-agent for the current file
  formats. It learned that IDE 1.0 hooks are `.kiro/hooks/*.json` with `trigger`/`matcher`/`action` (the older
  `.kiro.hook` with `when`/`then` is the 0.x format), that agents use `permissions` instead of `allowedTools`, and
  that new Powers use `plugin.json`. The hooks, agents and power in this repo follow the new formats.
- **Latest versions checked, then pinned.** `npm view` showed TypeScript 7.0 as `latest`. Kiro pinned `^5.9` for
  type-checking because the rest of the toolchain had not been verified against 7.0.

## Bugs and how they were caught

| # | What went wrong | Caught by | Fix |
|---|---|---|---|
| 1 | A PowerShell text replacement ran with a relative path that .NET resolved against a different folder, read `null`, and wrote an **empty** `lexicon/en.ts`. | Reading the file back before editing again | Rewrote the file; switched all scripted edits to Node with explicit checks that the text to replace exists |
| 2 | Parser kept the *original* spelling as the word, so "make **dat** bigger" produced a slot word "dat" instead of "that". | Unit test `homophones are normalized` | Tokens now carry `norm` text; slot words use it |
| 3 | Test for "no, the other one" ticked the clock before the 600 ms preview ended (the pointer stream had already moved engine time forward). | Unit test failure, then a debug replay | Test timing fixed; the engine behaviour was right |
| 4 | Hand-picked sabotage mutant "remove the type constraint" **survived**: no property covered it end to end. | `scripts/sanity-mutants.mjs` | Added a second P15 property: "turn that red" never binds a non-colourable object |
| 5 | A sabotage mutant that reversed `timedSlots` sort order survived because binding order comes from `withWordTimes`, not that sort. | `sanity-mutants.mjs` | Mutant retargeted at `withWordTimes`; P07 now kills it |
| 6 | `npm install` left a nested `estree-walker` that Workbox needs at v2 deduped to v3, so the PWA build crashed. | `vite build` | `overrides` in `package.json` plus a clean reinstall |
| 7 | Another local project already used port 5173; the first browser probe screenshotted that app instead. | Looking at the screenshot | Hocus apps use 5281, 5282, 5283 with `strictPort` |
| 8 | `Stage.screenOf()` used a stale camera matrix and a wrong "behind the camera" test, so every planet projected onto the Sun and typed "compare this with that" returned `no_target`. | Browser probe with real mouse movement over the 3D scene | `updateMatrixWorld()` before projecting and a view-space depth test |
| 9 | Moving planets were hard to point at. | Using it | Time slows to 15% while the pointer rests on any body |
| 10 | Windows PowerShell `Set-Content` re-encoded `é`, `·` and Devanagari as mojibake and added BOMs. | E2E test could not find the button "Pumpkin purée" | Repaired the files; added a rule to `.kiro/steering/tech.md` |
| 11 | First benchmark simulator always moved to another object after speaking, so the "pointer at final transcript" baseline scored 0%: unfair. | Reading the numbers critically | Simulator now keeps pointing 40%, drifts to empty space 30%, moves on 30%; documented in `docs/benchmark.md` |

## What the property tests did and did not find

- All 20 properties passed on their first run. That alone proves nothing, so Kiro broke the engine on purpose
  (`scripts/sanity-mutants.mjs`): margin rule off, stability off, confirmation off, word order reversed, undo
  wrong, type constraint off, "it" override off. Each mutant is killed by the property named for it. CI runs this.
- No real counterexample from a property has been found yet. **Do not stage one for the video.** If one appears in
  the nightly soak (`crew/hocus-soak-tester` or `.github/workflows/nightly.yml`), save it under
  `tests/properties/regressions/` and record it here.
- Stryker results: see `docs/mutation.md`.

## Spec review by a sub-agent

After the code existed, a sub-agent wrote the nine remaining specs from the code and listed every place where the
plan and the code disagreed. Kiro fixed these:

- camera pointing now pauses while the typed box has focus;
- "Move" appears in the keyboard actions menu (to the centre), so it has a non-voice path;
- the Parlor and Graveyard starter rooms are reachable (`load room two`, panel buttons);
- kiosk mode plays Judge Mode as an attract loop after two idle minutes;
- `loadReplay` applies the file's config; "Copy as test" points at the right folder;
- kitchen timers count down on the card;
- the four-corner calibration screen exists and uses `solveHomography`;
- missing unit tests for pose classification, mapping, word timing, "not that", "what was that" and `pointAction`.

Remaining unchecked tasks are listed in each `.kiro/specs/*/tasks.md`.

## Spec changes

(The `requirements-changed` hook asks the agent to log changes here.)

## Still to do by a human

- **Native-speaker review** of the Hindi and Tamil packs (`packages/core/src/lexicon/hi.ts`, `ta.ts`) and app
  vocabularies. Reviewer and date go here.
- **Recorded sessions.** All six files in `tests/replays/` are synthetic. Record real sessions with the X-ray
  "Recorder" tab in dim and bright light and with different accents, export them, and drop them in.
- **Steering experiment.** Build one small module twice in Kiro, once with `.kiro/steering/` disabled, and count the
  rule violations the hooks and properties catch in each. Record the result here.
- **IDE vs CLI vs Web.** This build was done in the Kiro IDE. Notes on the other surfaces belong in the write-up only
  if they were actually used.
