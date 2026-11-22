---
name: build-hocus-app
description: Build or extend a Hocus point-and-speak app (pointing words like this, that, here, there bound to what the user pointed at). Use when creating a defineApp file, adding an action or vocabulary, or debugging why "that" bound to the wrong object.
---

# Building with Hocus

## The contract an app provides

1. `selectables(state)`: ids, labels, kinds and capabilities of what can be pointed at.
2. `actions`: slots + a pure `reduce(state, args)`; optional `respond`, `describe`, `requires`, `destructive`.
3. `vocabulary` for `en`, `hi`, `ta`, and `examples` per language.
4. Its own three.js scene: `stage.register(id, object3D)`, `stage.addSurface(name, mesh)`.

Everything else (tracking, speech, parsing, fusion, preview, ask, undo, replay, X-ray, Spellbook) is the skeleton.

## Rules

- Never bind a pointing word yourself. Only `resolveFrame()` turns words into ids or places.
- No `Date.now()` or `Math.random()` in `packages/core`. Time is data on every event.
- Unclear means ask. No evidence means "Point at something first". Destructive bulk actions confirm.
- Every action needs a keyboard path (`menuLabel` or a panel button).

## Debug a wrong binding with the hocus MCP server

1. `list_apps` to see ids and actions.
2. `resolve` with the utterance, the word times and a dwell timeline, e.g.
   `{ "app": "planet-explorer", "utterance": "compare this with that", "wordTimesMs": [900, 1900],
   "dwells": [{ "id": "mars", "startMs": 300, "endMs": 1000 }, { "id": "earth", "startMs": 1150, "endMs": 2000 }] }`.
3. Read each word's candidates: `evidence` and its parts (`time`, `conf`, `quality`, `stability`).
4. For recorded sessions use `replay` and `explain` on `tests/replays/*.replay.json`.
5. Run `lint_lexicon` after changing any vocabulary.

## Scaffold

`node tools/create-hocus-app/src/index.mjs <id> "<Title>"` creates `examples/<id>/` and a passing test.
