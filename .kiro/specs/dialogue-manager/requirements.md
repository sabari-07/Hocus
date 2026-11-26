# Requirements Document

Spec: dialogue-manager

## Introduction

The dialogue manager is the part of `engine.step` (`packages/core/src/engine.ts`) that decides what happens
after the parser and the resolver have done their work: preview, confirm, ask, execute, cancel, undo and redo,
repair, and how keys, gestures and ticks move the dialogue between phases. It is pure like the rest of the
engine: time arrives only as event timestamps. The user-facing safety rules are already stated in
fusion-engine requirement 5 (and 6.5-6.6 for calibration); this spec describes the phase machine that
implements them and the parts fusion-engine does not cover.

## Glossary

- **Phase:** the dialogue state, one of `idle`, `listening`, `preview`, `confirm`, `ask` (`CoreState.phase`).
- **Pending:** a resolved command waiting in preview or confirm: action, args, ids, preview sentence, snapshot.
- **Snapshot:** everything needed to resolve a command again (frame with word times, samples, selection, lasso, memory, exclusions).
- **Tick:** an event that only carries time; it lets timers expire without a wall clock.
- **Document:** app state plus names (`Doc`); the unit of undo.
- **pointAction:** an app's action for a bare "that one" said outside a question (for example a quiz answer).

## Requirements

### Requirement 1: Phases and outcomes

**User Story:** As a user, I want to see and hear what Hocus understood before it acts, so that I can stop it when it is wrong.

#### Acceptance Criteria

1. THE SYSTEM SHALL always be in exactly one phase: `idle`, `listening`, `preview`, `confirm` or `ask`.
2. WHEN a `start` speech event arrives while idle, THE SYSTEM SHALL enter `listening`; WHEN `end` or a final transcript arrives, THE SYSTEM SHALL return from `listening` to `idle`; a speech start in any other phase SHALL NOT change the phase.
3. WHEN a frame resolves, THE SYSTEM SHALL enter `preview` for `previewMs` (600 ms) with the pending command, highlight its objects as locked, announce the preview sentence and play the `lock` cue; IF `previewMs` is 0, THEN THE SYSTEM SHALL execute at once.
4. WHEN resolution returns `ask`, THE SYSTEM SHALL enter `ask` for `askTimeoutMs` (8000 ms), highlight the options as ambiguous with numbers, announce the question assertively and play the `ask` cue.
5. WHEN resolution returns `no_target`, THE SYSTEM SHALL return to idle and announce "Point at a spot first." for a place slot, "Show me the size with your thumb and finger." for a quantity, "There is nothing else it could be." after exclusions, and "Point at something first." otherwise.
6. WHEN a transcript is not understood, THE SYSTEM SHALL record a `no_action` decision, announce the hint ("I did not catch a command. Try …") and play the `error` cue, and SHALL leave the phase and the document unchanged.

### Requirement 2: Ticks and timers

**User Story:** As a developer, I want timers to depend only on event times, so that replays expire the same way they did live.

#### Acceptance Criteria

1. THE SYSTEM SHALL keep `state.t` as the largest event time seen so far and SHALL compare phase deadlines (`until`) only against it.
2. WHEN a tick reaches the end of a preview, THE SYSTEM SHALL execute the pending command.
3. WHEN a tick reaches the end of an ask, THE SYSTEM SHALL clear the highlights and return to idle without an announcement and without acting.
4. WHEN a tick reaches the end of a confirm, THE SYSTEM SHALL cancel and SHALL NOT execute.
5. WHILE the phase is `preview`, `ask` or `confirm`, the runtime SHALL dispatch a `tick` event every 50 ms.

### Requirement 3: Confirm, cancel and choose by key, voice and gesture

**User Story:** As a user, I want the same answers to work by key, by voice and by hand gesture, so that I can use whichever is free.

#### Acceptance Criteria

1. WHEN the user confirms (Enter, "yes", a held thumbs-up, or the Run / Confirm button) in `preview` or `confirm`, THE SYSTEM SHALL execute the pending command; in other phases a confirm SHALL do nothing.
2. WHEN the user cancels (Esc, "stop" / "cancel" / "no", a held open palm, or the Cancel button) in `preview`, `confirm` or `ask`, THE SYSTEM SHALL return to idle, clear highlights, announce "Cancelled." and play the `cancel` cue.
3. WHEN the user answers an ask with a number key 1-9, an option button, or a spoken number or ordinal, THE SYSTEM SHALL bind that option to the asked slot, keep the bindings already made, and resolve again, which can preview or ask about the next slot.
4. WHEN the user says "this one" or "that one" during an ask, THE SYSTEM SHALL score only the offered options around that word's time (the 1.5 s before submit for typed text) and choose the winner if the decision is unambiguous; otherwise the ask SHALL stay open.
5. WHEN the user says "neither" during an ask, THE SYSTEM SHALL cancel.
6. WHEN an action is destructive and affects more than one object, or is marked `alwaysConfirm`, THE SYSTEM SHALL enter `confirm` for `confirmTimeoutMs` (8000 ms) instead of preview and announce the question assertively.

### Requirement 4: Execution, undo and redo

**User Story:** As a user, I want every change to be undoable, so that trying things is safe.

#### Acceptance Criteria

1. WHEN a command executes, THE SYSTEM SHALL call the app reducer with the bound arguments and, for actions that mutate (the default), push the previous document onto the undo stack (at most 100 entries) and clear the redo stack.
2. WHERE an action sets `mutates: false`, THE SYSTEM SHALL apply the reducer's state without an undo entry.
3. WHEN a command has executed, THE SYSTEM SHALL return to idle, remember the acted-on ids for "it", play the `run` cue, and announce (and speak) the app's reply, or announce "<sentence>. Done. Say undo to take it back." when the action has no reply.
4. WHEN the user undoes (Ctrl+Z, "undo", the ↶ button), THE SYSTEM SHALL silently drop any open phase and restore the previous document; redo (Ctrl+Shift+Z, "redo", ↷) SHALL re-apply it; an empty stack SHALL announce "Nothing to undo." or "Nothing to redo.".
5. WHEN a naming command executes, THE SYSTEM SHALL take the name away from any other object, drop the target's older names, push the change on the undo stack and announce "<old label> is now called <name>.".

### Requirement 5: Repair

**User Story:** As a user, I want to say "no, the other one" or "not that" when Hocus picked the wrong thing, so that fixing a mistake takes one phrase.

#### Acceptance Criteria

1. WHEN "no, the other one" or "not that" follows a pending preview or confirm, THE SYSTEM SHALL drop the pending command; WHEN it follows an executed action that mutated the document, THE SYSTEM SHALL undo that action first.
2. WHEN the user says "no, the other one", THE SYSTEM SHALL exclude the object chosen for the first pointing-bound word and force the best remaining candidate for that slot, then preview again.
3. WHEN the user says "not that", THE SYSTEM SHALL exclude the chosen object and resolve again without forcing, which can ask among the rest or say there is nothing else.
4. IF there is no earlier command, no resolution or no remaining candidate, THEN THE SYSTEM SHALL announce "There is nothing else it could be." and change nothing else.
5. WHEN "no, the other one" repairs a spoken (not typed) command whose word was seen in an interim, THE SYSTEM SHALL move the lag toward the value that would have made the new choice win (fusion-engine 6.5) and emit a `calibrated` effect.

### Requirement 6: Calibration, configuration and language events

**User Story:** As a user, I want my measured delay, settings and language to take effect at once and to replay the same way.

#### Acceptance Criteria

1. WHEN a `calibrate` event arrives, THE SYSTEM SHALL set `lagMs` clamped to [`lagMin`, `lagMax`] and emit `calibrated`.
2. WHEN a `config` event arrives, THE SYSTEM SHALL apply the patch through `patchConfig`, which clamps every number to safe bounds.
3. WHEN a `lang` event arrives, THE SYSTEM SHALL switch to that language pack and drop the current utterance track.
4. WHEN the engine emits `calibrated`, the runtime SHALL store the rounded lag in Settings.

### Requirement 7: Pointing answers, direct commands and "what was that?"

**User Story:** As a user, I want to answer by pointing and to use menus without voice, so that every path reaches the same result.

#### Acceptance Criteria

1. WHERE the app declares `pointAction`, WHEN the user says only "this one" or "that" outside an ask, THE SYSTEM SHALL run that action with the pointing word in its first object slot, through normal resolution and preview.
2. WHEN "this one" is said outside an ask and the app has no `pointAction`, THE SYSTEM SHALL do nothing.
3. WHEN a `command` event arrives (actions menu, palette and nudge buttons), THE SYSTEM SHALL execute it at once with its concrete arguments, without preview, except that destructive bulk and `alwaysConfirm` actions SHALL enter `confirm`.
4. WHEN the user asks "what was that?", THE SYSTEM SHALL announce and speak the label of the last dwell segment in the pointer buffer that reached `minEvidence`, or "You have not pointed at anything yet.".
