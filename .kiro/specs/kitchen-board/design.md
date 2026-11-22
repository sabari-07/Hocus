# Design: kitchen-board

## Overview

`kitchenApp` is a `defineApp<Kitchen>` with five actions and no entities. The scene draws each card as a plane
with a canvas texture that is redrawn on every `sync`. `main.tsx` mounts `HocusApp` with the default right panel
(the scene list) and a Judge Mode script.

```mermaid
flowchart LR
  U[point + "double this"] --> E[engine]
  E -->|reduce + respond| K[(Kitchen: cards, current, done, timers)]
  K -->|sync| S[createKitchenScene: card planes + canvas textures]
  S --> ST[Stage: cards registered, board surface]
```

## Components

| File | Responsibility | Requirements |
|---|---|---|
| `examples/kitchen-board/src/app.ts` | `Card`, `Kitchen`, `CARDS`, `show`, `kitchenApp` (actions, vocabulary) | 1.1, 1.2, 2 |
| `examples/kitchen-board/src/scene.ts` | `cardTexture`, `createKitchenScene` (board surface, card registration, current card float) | 1.3 |
| `examples/kitchen-board/src/main.tsx` | Mounts `HocusApp`, `JUDGE` (double, timer, done, next) | 3.3 |

## Actions

| Action | Slots | Flags | Reducer | Reply |
|---|---|---|---|---|
| `next` | none | | `current` to the next step, capped at the last | the new step's text |
| `read` | `target` | `mutates: false` | none | the card text |
| `timer` | `target` | `requires: step` | add id to `timers` | "Timer set for <n> minutes." |
| `double` | `target`, `factor` | `requires: ingredient`, default factor 2; triggers `@sizeUp`, `@sizeDown` | `qty × factor` | the new amount |
| `done` | `target` | | add id to `done` | |

"double" and "half" are size words in the packs (factors 2 and 0.5), so the same action handles both.

## Checks

| Check | Where | Requirements |
|---|---|---|
| Lint, examples in en / hi / ta, unique selectables | `tests/unit/apps.test.ts` | 2.6 |
| "double this" on the pumpkin purée | `tests/replays/kitchen-double.replay.json` | 2.1, 3.3 |
| `src/app.ts` within 150 lines (82 today) | `scripts/check-app-size.mjs` | 3.2 |

## Known gaps

- This spec was written after the code, so the app was not literally generated from it.
- A timer only marks the card; there is no countdown and no alarm.
- Hindi and Tamil have no example for "half".
- `testSnippet` from the X-ray points at `../../apps/kitchen-board/...`, but this app lives in `examples/`.
