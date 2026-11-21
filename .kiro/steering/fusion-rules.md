---
inclusion: fileMatch
fileMatchPattern: ["packages/core/**", "packages/testkit/**", "tests/properties/**", "tools/hocus-mcp/**"]
---

# Fusion engine rules (non-negotiable)

These rules exist because AI-written timing code tends to fail in the same ways:
reading the wall clock, sampling the pointer "now" instead of at word time, and guessing when unsure.

1. **No wall clock, no hidden randomness in `packages/core`.** Never call `Date.now()`, `performance.now()`,
   `new Date()` or `Math.random()`. Time arrives as data (`t: Millis` on every event). Randomness, if ever
   needed, comes from `createRng(seed)` in `core/src/random.ts`. `scripts/check-determinism.mjs` enforces this.
2. **No DOM or browser globals in core.** No `window`, `document`, `navigator`, `requestAnimationFrame`.
3. **The core is one pure function.** `engine.step(state, event) -> { state, effects }`. Do not mutate `state`.
   Do not keep module-level mutable variables.
4. **All state changes go through app reducers** declared in `defineApp`. The engine never edits app state itself.
5. **All binding goes through `resolveFrame()`.** Nothing else may turn a deictic word into an id or a place.
6. **Evidence is time-windowed around the word time `tWord`, never around "now".** Window default
   `[tWord - 800, tWord + 300]` ms. Samples carry their own `hits` computed at capture time (objects move).
7. **Never guess.** If best evidence < `minEvidence` -> `no_target`. If `(best - second) / best < margin` -> `ask`.
   Unknown phrases -> `no_action` with a hint. Low confidence never executes silently.
8. **Several deictic words bind in spoken order** (`order` field), each with its own `tWord`.
9. **Type constraints only remove candidates** (capability filter happens before scoring).
10. **Destructive bulk actions require confirmation.** Every executed action is undoable to the exact prior document.
11. **Every decision emits a `DecisionRecord`** (inputs, per-candidate evidence parts, params, result) so the X-ray
    and `hocus-mcp explain` can show *why*.
12. Config numbers (window, margin, minEvidence, lag) live in `DEFAULT_CONFIG` and are documented in
    `.kiro/specs/fusion-engine/design.md`. Change them there and in the spec together.
