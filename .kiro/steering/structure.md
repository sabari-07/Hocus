---
inclusion: always
---

# Repository structure

```
.kiro/            specs (9), steering (8), hooks, agents (3), skills, settings/mcp.json
packages/
  core/           @hocus/core      pure engine. NO DOM, NO browser globals, NO Date.now/Math.random
  input/          @hocus/input     pointer hub, mouse/touch adapters, One Euro filter use, lasso capture, mapping
  vision/         @hocus/vision    MediaPipe hand + face trackers -> PointerSample
  speech/         @hocus/speech    Web Speech, VAD, typed input, TTS, on-device proposer
  three/          @hocus/three     Stage, SelectableRegistry, surfaces, outlines, CSS2D labels
  ui/             @hocus/ui        React kit: HocusApp shell, Wisp, SpeechBar, Ask, Spellbook, Settings, Onboarding, Judge Mode
  devtools/       @hocus/devtools  X-ray, timeline simulator, recorder, replay export
  testkit/        @hocus/testkit   fast-check arbitraries, simulated users, benchmark harness
apps/
  room-designer/  App 1 (creative tool)
  planet-explorer/App 2 (exhibit + quiz)
examples/
  kitchen-board/  App 3 (reuse proof, built from one spec)
tools/
  hocus-mcp/      MCP server wrapping @hocus/core
  create-hocus-app/ scaffolder
power/            Kiro Power (plugin.json, mcp.json, skills)
crew/             Kiro Crew soak-tester app (publish as its own repo)
tests/
  unit/ properties/ replays/ e2e/
scripts/          determinism lint, app-size budget, benchmark, replay generator, model fetch
docs/             architecture, kiro-journal, benchmark, write-up, video script
```

## Placement rules

- Anything that decides *what the user meant* goes in `packages/core`. Adapters only produce events.
- An app folder contains only: `src/app.ts` (the `defineApp` definition), `src/scene.ts` (three.js visuals),
  `src/main.tsx` (mount), styles and public assets. Shared behavior belongs in a package.
- Tests that cite a requirement live in `tests/properties/` and are named `P<nn>-<slug>.prop.test.ts`.
- Recorded or generated sessions live in `tests/replays/*.replay.json` with an `expected` block.
