# Mutation testing (Stryker)

Generated from `reports/mutation/mutation.json` after `npm run test:mutation` on 2026-11-22.
Scope: the fusion math in `packages/core` (`stryker.config.json` → `mutate`). Tests per mutant: unit + property
tests with 5 cases each (`stryker.vitest.config.ts`), so the scores are a lower bound.

| File | Killed | Timed out | Survived | No coverage | Score |
|---|---|---|---|---|---|
| `evidence.ts` | 171 | 1 | 44 | 8 | 76.8% |
| `resolver.ts` | 294 | 57 | 201 | 215 | 45.8% |
| `smoothing.ts` | 21 | 1 | 16 | 2 | 55.0% |
| `timing.ts` | 83 | 9 | 8 | 1 | 91.1% |
| `config.ts` | 4 | 3 | 0 | 0 | 100.0% |
| `calibration.ts` | 26 | 1 | 15 | 0 | 64.3% |
| `geometry.ts` | 125 | 4 | 29 | 0 | 81.6% |
| **All** | 724 | 76 | 313 | 226 | **59.7%** |

## What the first runs showed

- The first full run reported almost every mutant as surviving. Stryker copies the repo into a sandbox, but
  `@hocus/core` resolved through the `node_modules` symlink to the *original* sources, so mutants were never run.
  Fixed with explicit aliases in `stryker.vitest.config.ts`.
- The first valid run scored **50.4%** on evidence, timing and calibration. `calibrateLag` was at **19%** because no
  test exercised the search, only the nudge. New tests in `tests/unit/evidence.test.ts` pin the time-weight shape,
  stability, dt capping, exact evidence integration, the margin rule, dwell segments, the calibration search and
  every word-timing method. Score for those three files went to **77.4%**.
- `resolver.ts` is the weakest file. Many survivors are in branches that only change which *equivalent* path finds
  the same answer (selection vs memory fallbacks) and in X-ray-only fields (`window`, `via` labels).
  `tests/unit/resolver.test.ts` covers places, kinds, plurals, spatial words, implicit objects and distinct slots.

## Next

- Raise `FC_RUNS` for the nightly run so property tests kill more boundary mutants.
- Widen `mutate` to `engine.ts` and `parser.ts` (multi-hour; nightly only).
