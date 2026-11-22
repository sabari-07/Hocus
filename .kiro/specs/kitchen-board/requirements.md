# Requirements: kitchen-board

## Introduction

The Recipe Board is the third app, a reuse proof: one small spec on top of the Hocus skeleton, with its
behaviour in under 150 lines of `examples/kitchen-board/src/app.ts`. A cook with messy hands points at a recipe
card and says "double this", "start a timer for that" or "mark this done". Everything else (tracking, speech,
parsing, binding, preview, undo, help, accessibility) comes from the skeleton.

## Glossary

- **Card:** an ingredient card (text, quantity, unit) or a step card (text, minutes).
- **Current step:** the step the cook is on (`current`).

## Requirements

### Requirement 1: Recipe cards

**User story:** As a cook, I want each ingredient and step on its own card, so that I can point at the one I mean.

1. THE SYSTEM SHALL start with 4 ingredient cards (flour, pumpkin purée, brown sugar, eggs) and 4 step cards, with step 1 current.
2. THE SYSTEM SHALL expose each card as a selectable labelled with the ingredient name or "Step <n>", with the capability `ingredient` or `step`.
3. THE scene SHALL show the cards as 3D panels on a board, with the current step raised and marked, done steps marked "✓ done" and steps with a timer marked "⏱ timer running".

### Requirement 2: Hands-free commands

**User story:** As a cook with flour on my hands, I want to scale amounts and track steps by pointing and speaking, so that I never touch the screen.

1. WHEN the cook says "double this" or "half that" at an ingredient, THE SYSTEM SHALL multiply its quantity by 2 or 0.5 and read the new amount; step cards SHALL NOT be candidates.
2. WHEN the cook says "start a timer for that" at a step, THE SYSTEM SHALL mark that step as having a timer and say its minutes; ingredient cards SHALL NOT be candidates.
3. WHEN the cook says "mark this done", THE SYSTEM SHALL mark the card done.
4. WHEN the cook says "next", THE SYSTEM SHALL move to the next step (staying on the last one) and read it.
5. WHEN the cook says "read that again", THE SYSTEM SHALL read the card without adding an undo step.
6. THE SYSTEM SHALL offer every action in `en`, `hi` and `ta` with Spellbook examples.

### Requirement 3: Reuse proof

**User story:** As a developer judging the skeleton, I want a third app that is tiny, so that I can see how much the skeleton does.

1. THE app folder SHALL contain only `src/app.ts`, `src/scene.ts`, `src/main.tsx`, config and public assets.
2. THE behaviour file `src/app.ts` SHALL stay within the 150-line budget of `scripts/check-app-size.mjs`.
3. THE app SHALL ship a 4-step Judge Mode script and the replay `tests/replays/kitchen-double.replay.json`.
