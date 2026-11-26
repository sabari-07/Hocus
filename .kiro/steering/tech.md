---
inclusion: always
---

# Tech stack and commands

- **Language:** TypeScript, `strict` + `noUncheckedIndexedAccess`. Zod validates data at every trust boundary
  (events from adapters, replay files, MCP tool input, AI proposer output).
- **Monorepo:** npm workspaces (`packages/*`, `apps/*`, `examples/*`, `tools/*`). Packages are consumed as
  TypeScript source (`exports` point at `src/index.ts`); Vite and Vitest compile them.
- **3D:** three.js only (no 2D canvas scenes). Shared stage, picking and highlights live in `@hocus/three`.
  DOM is used only for UI chrome (speech bar, drawers, labels via CSS2DRenderer, live regions).
- **UI:** React 19, Tailwind CSS v4 (`@tailwindcss/vite`), tokens as CSS variables, Radix Dialog for drawers,
  Zustand for UI-only state. App/document state lives in the Hocus engine, never in React state.
- **Vision:** `@mediapipe/tasks-vision` GestureRecognizer (landmarks + built-in gestures) and FaceLandmarker.
  Model files and WASM are self-hosted under each app's `public/` (see `scripts/fetch-models.mjs`).
- **Speech:** Web Speech API with push-to-talk, interim results for word timing, optional `processLocally`;
  own voice-activity detection; `speechSynthesis` for read-back; typed fallback always present.
- **Tests:** Vitest projects `unit`, `properties`, `replays`; fast-check for properties; Playwright + axe for e2e;
  Stryker for mutation testing of `@hocus/core`.

## Commands (run from the repo root)

| Task | Command |
|---|---|
| Install | `npm install` |
| Dev servers | `npm run dev:room`, `npm run dev:planets`, `npm run dev:kitchen` |
| Everything fast | `npm run check` (determinism lint, app-size, typecheck, all tests) |
| Property tests | `npm run test:props` (`FC_RUNS` env sets runs; default 100) |
| Replays | `npm run test:replays` |
| E2E + a11y | `npm run test:e2e` |
| Mutation | `npm run test:mutation` |
| Benchmark | `npm run bench` (writes `docs/benchmark.md`) |
| MCP server | `npm run mcp` |

Never run long-lived dev servers in a blocking shell; use a background process.
Pin dependency versions with `^` on the major that was verified; re-check before submitting.

## Running Vitest

Never call `vitest` or `npx vitest` directly in scripts, hooks or agents: use the npm scripts or
`node scripts/vitest.mjs <args>`. Kiro starts hook commands with a lower-case drive letter (`c:\`), and Vitest 5 on
Windows then fails every suite with "Cannot read properties of undefined (reading 'config')". The wrapper fixes the cwd.
`npm run verify` runs every check (hook gate, check, lexicon lint, sabotage mutants, builds, e2e) the way a hook would.

## Windows shell gotcha (learned the hard way)

Windows PowerShell 5 `Get-Content`/`Set-Content` read and write ANSI by default and add a BOM with `-Encoding utf8`.
That corrupted `é`, `·` and Devanagari text once in this repo. Edit text files with the editor tools or Node (`fs.readFileSync(p, 'utf8')`), never with PowerShell string replacement.

