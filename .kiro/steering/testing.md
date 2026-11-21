---
inclusion: fileMatch
fileMatchPattern: ["tests/**", "packages/testkit/**", "vitest.config.ts", "playwright.config.ts", "stryker.config.json"]
---

# Testing rules

## Property tests (fast-check)

- One file per property: `tests/properties/P<nn>-<slug>.prop.test.ts`.
- The `describe` title starts with the property id and cites requirement ids, e.g.
  `P03 near-equal evidence asks (fusion-engine 2.3)`.
- Use arbitraries from `@hocus/testkit` (`arbScene`, `arbDwellPath`, `arbUtterance`, ...). Do not hand-roll
  random data with `Math.random()`.
- Runs come from `numRuns()` in testkit (env `FC_RUNS`, default 100). Never hard-code `numRuns` in a test.
- Every property must be **shrinkable** (build values from fast-check combinators, not from a seed you expand yourself).
- When a property fails: keep the shrunk counterexample as a permanent example in
  `tests/properties/regressions/<id>.test.ts`, and log it in `docs/kiro-journal.md` under "Bugs caught by properties".

## Replays

- `tests/replays/*.replay.json` are event logs with an `expected` block (decisions and final document).
- Files with `"origin": "synthetic"` come from `scripts/generate-replays.ts`. Real sessions recorded with the
  Hocus Lab recorder use `"origin": "recorded"`. Never relabel synthetic data as recorded.

## End-to-end

- Playwright drives the built apps with **mouse + typed commands** (no camera needed) and runs axe on each screen.
- Fail on any axe violation with impact `serious` or `critical`.

## Honesty

- Benchmark numbers in docs must be produced by `npm run bench`, with the seed and run count printed.
