# Design Document

## Overview

The app is a `defineApp<Sky>` definition over static data. All actions are `mutates: false`: they change what is
shown (`info`, `compare`, `focus`, `moonsOf`, `speed`, `trueScale`, `quiz`) but add no undo steps, because nothing
is being edited. Replies come from `respond`, so the engine announces and speaks them. The planets keep moving;
pointing still works because every sample carries the hits that were true when it was captured.

```mermaid
flowchart LR
  D[(solar-system.json: source, bodies, quiz)] --> A[app.ts: planetApp]
  U[point + "what is that?" / "that one"] --> E[engine]
  A --> E
  E -->|reduce + respond| SKY[(Sky)]
  E -->|announce + speak reply| RT[runtime]
  SKY -->|sync| S[createPlanetScene]
  SKY --> P[main.tsx info panel]
  S -->|moving holders, hits at capture| E
```

## Architecture

Planet Explorer is one `defineApp` definition in `apps/planet-explorer/src/app.ts`, a three.js scene in `scene.ts` and a mount in `main.tsx`; body facts come from `apps/planet-explorer/src/data/solar-system.json`. See Overview.

## Components and Interfaces
| File | Responsibility | Requirements |
|---|---|---|
| `apps/planet-explorer/src/data/solar-system.json` | `source` (name, URLs, `retrieved: 2026-11-22`, note), 10 `bodies`, 8 `quiz` entries | 1.1, 1.2 |
| `apps/planet-explorer/src/app.ts` | `BODIES`, `QUIZ`, `SOURCE`, `body`, `describeBody`, `compareBodies`, `ratio`, `INITIAL`, `planetApp` with `pointAction: 'answer'` | 1.3, 1.4, 2-5, 6.1 |
| `apps/planet-explorer/src/scene.ts` | `createPlanetScene`: bodies, banded textures, ring, tilt, orbits, Moon, layouts, hover slow-down, camera fly-to, moons group, chips, bursts | 2.4, 2.5, 4.2, 4.4, 6.2, 6.3 |
| `apps/planet-explorer/src/main.tsx` | Mounts `HocusApp`; `JUDGE` script; top-bar true-scale and quiz buttons; panel with quiz, comparison table or body table, scene list, source line, slower / faster / reset | 1.3, 3.2, 4.5, 5, 6.4 |

## Actions

| Action | Slots | Flags | Effect on `Sky` | Reply |
|---|---|---|---|---|
| `describe` | `target` | | `info`, clears `compare` | `describeBody` |
| `distance` | `target` | `requires: orbits` | `info` | million km from the Sun, or thousand km from Earth for the Moon |
| `size` | `target` | | `info` | diameter and ratio to Earth |
| `compare` | `a`, `b` | `distinct` | `compare = [a, b]` | `compareBodies` |
| `zoom` | `target` | | `focus`, `info` | preview sentence only |
| `moons` | `target` | `requires: hasMoons` | `moonsOf`, `info` | count with "(NASA, 2026-11-22)" |
| `faster` / `slower` | none | | `speed × 2` (max 64) / `÷ 2` (0 below 0.1) | |
| `scaleMode` | `on: boolean` | default true | `trueScale` | |
| `quiz` | `on: boolean` | default true | start or clear `quiz` | first question |
| `answer` | `target` | `pointAction` | next index, score, asked, last | right / wrong with hint, score, next question |
| `reset` | none | | `INITIAL` but keeps `quiz` | |

Every action has `mutates: false`. App verbs per language add the question phrases ("how far", "कितनी दूर",
"எவ்வளவு தூரம்") and quiz words; colour, size and pointing words come from the skeleton packs.

## Scene

- Each body is a `THREE.Group` holder registered with `radius: 1.15`, so small planets are easy to hit.
- Two layouts: readable (fixed gaps and sizes) and true scale (`TRUE.dist`, `TRUE.size`); `sync` re-runs
  `layout()` only when `trueScale` changes.
- `stage.onFrame` advances orbit angles by `speed × timeScale` with a period that follows each planet's year;
  `timeScale` eases to 0.15 while `pointer.topHit` is set. The Moon circles Earth.
- With `focus` set, the camera eases to a point near the body; otherwise to an overview that depends on the layout.
- `showMoons(id)` draws up to 14 small spheres; the real count is in the reply.
- Chips show the names of the focused, described and compared bodies.

## Data Models

The app state and action reducers are defined in `apps/planet-explorer/src/app.ts`; the body facts are in `data/solar-system.json`; each body is exposed to the engine as a `Selectable` (`packages/core/src/types.ts`).

## Correctness Properties

### Property 1: Lint, examples in en / hi / ta, unique selectables

Where: `tests/unit/apps.test.ts`

**Validates: Requirements 6.1**

### Property 2: "compare this with that" binds Mars then Earth in spoken order

Where: `tests/replays/planets-compare.replay.json`

**Validates: Requirements 3.1**

### Property 3: Quiz started by a typed command and answered by "that one" on Venus

Where: `tests/replays/planets-quiz.replay.json`

**Validates: Requirements 5.1, 5.2**

### Property 4: Hindi "यह क्या है" while pointing at Jupiter

Where: `tests/replays/planets-hindi.replay.json`

**Validates: Requirements 2.1, 6.1**

### Property 5: `src/app.ts` within 300 lines (208 today)

Where: `scripts/check-app-size.mjs`

**Validates: Requirements 6.5**


## Error Handling

- Requests that do not fit a body are filtered by capability before scoring: the Sun is never a candidate for
  "how far" and only planets for "moons".
- Missing values (for example the Sun's day and moons) show as "—" in the panel.
- Quiz questions cycle with `index % QUIZ.length`, so the quiz never runs out.

## Testing Strategy

Property tests are listed under Correctness Properties. `npm run check` runs the determinism lint, the app-size budget, the typecheck and all tests (unit, properties, replays).

## Known gaps

> **Status (2026-11-22):** this list was written by the spec-review pass before the fixes. Items now marked `[x]` in `tasks.md` are fixed; see `docs/kiro-journal.md`.


- The moon counts and other numbers are only as current as the retrieval date in the data file; there is no
  automated refresh or check against the NASA sheet.
- Facts and replies are English only; Hindi and Tamil users can ask in their language but hear English answers.
- Because all actions are `mutates: false`, "undo" does not step back through views.
