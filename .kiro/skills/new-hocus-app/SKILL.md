---
name: new-hocus-app
description: Create a new Hocus point-and-speak app from the skeleton. Use when the user wants a new app, kiosk, demo or example that understands "this", "that", "here" and "there".
---

# Create a new Hocus app

1. Scaffold: `node tools/create-hocus-app/src/index.mjs <app-id> "<Title>"`. It writes `examples/<app-id>/` with
   `src/app.ts` (the `defineApp` contract), `src/scene.ts` (a three.js stage with three pointable cubes),
   `src/main.tsx`, `index.html`, `vite.config.ts`, and a passing test `tests/unit/<app-id>.test.ts`.
2. Run `npm install` so the new workspace links, then `npm run models` to self-host the MediaPipe files.
3. Edit only `src/app.ts` for behaviour. The contract has four parts:
   - `selectables(state)`: id, label, kind and capabilities of everything that can be pointed at;
   - `actions`: slots (`object`, `objects`, `place`, `entityType`, `factor`, `quantity`, `color`, `boolean`,
     `number`), a pure `reduce(state, args)`, optional `respond`, `describe`, `requires`, `destructive`;
   - `vocabulary` for `en`, `hi` and `ta` (verbs and nouns);
   - `examples` per language for the Spellbook.
4. Put visuals in `src/scene.ts` and register every selectable with `stage.register(id, object3D)`.
   Register floors and walls with `stage.addSurface(name, mesh)` so "here" and "there" work.
5. Check: `npm run lexicon:lint`, `npx vitest run tests/unit/<app-id>.test.ts`, `npm run app-size`.
6. Keep `src/app.ts` under 150 lines for an example app (300 for a full app).

Rules that always apply: `.kiro/steering/fusion-rules.md` (never bind a target yourself; the engine does it),
`.kiro/steering/a11y.md` (keyboard path for every action) and `.kiro/steering/i18n-rules.md`.

The `hocus` MCP server (`resolve`, `replay`, `explain`, `lint_lexicon`) lets you check the new app's commands
against the real engine before writing UI code.
