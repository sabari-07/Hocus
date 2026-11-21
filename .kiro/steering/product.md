---
inclusion: always
---

# Product: Hocus

**Tagline:** Point. Speak. Done.

Hocus is an open-source TypeScript skeleton for web apps that understand pointing words.
A person points (finger, head, mouse or touch) and says what to do: "make that bigger",
"put it there", "compare this with that". Hocus works out what "that" and "there" meant
at the moment the word was spoken, shows its interpretation, and only then acts.

Built for Kiroween 2026, category **Skeleton Crew**: a lean template plus two very
different apps built from it.

## What ships

| Layer | Contents |
|---|---|
| Hocus SDK (the skeleton) | `@hocus/core` fusion engine, `@hocus/input`, `@hocus/vision`, `@hocus/speech`, `@hocus/three`, `@hocus/ui` |
| Apps | `apps/room-designer` (creative 3D editor), `apps/planet-explorer` (touchless 3D exhibit + quiz), `examples/kitchen-board` (reuse proof) |
| Hocus Lab | `@hocus/devtools`: X-ray, timeline simulator, recorder, replay, export as test |
| Kiro tooling | specs, steering, hooks, agents, `tools/hocus-mcp`, `power/`, `.kiro/skills/new-hocus-app` |

## Who it is for

- Developers who want "point and say" without a research project.
- People whose hands are busy or messy, people who cannot use a mouse (head pointer),
  museum and classroom kiosks, and speakers of Hindi and Tamil.

## Product principles (do not break these)

1. **Language proposes, the engine disposes.** The core is rule-based and deterministic.
   Optional AI only proposes a command frame; it never picks a referent and never executes.
2. **Never guess silently.** Unclear means ask. No evidence means "Point at something first".
3. **Everything is an event log.** Replay, X-ray, tests and the benchmark read the same log.
4. **Every input has a fallback.** Hand, head, mouse, touch; voice or typing; Judge Mode.
5. **Private by design.** Camera frames never leave the device. No analytics.
6. **Small core, optional layers.** Each app stays under ~300 lines of app-specific code.
7. **Measure, do not claim.** Every number in docs comes from a script in this repo.

## Voice and tone in UI copy

Friendly, a hint of witchy humor, always clear first:
"Point at something first." "Did you mean the pumpkin or the ghost?" "Done. Say undo to take it back."

UI names: **Wisp** (pointer), **Crypt** (item palette), **Spellbook** (help), **X-ray** (decision view).
