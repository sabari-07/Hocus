# Requirements: fusion-engine

## Introduction

The fusion engine decides what a pointing word ("this", "that", "it", "these", "here", "there") refers to,
by combining the pointer history with the estimated time each word was spoken. It is the heart of the Hocus
skeleton: pure, deterministic and replayable. It lives in `packages/core`.

## Glossary

- **Deictic word:** a pointing word whose meaning depends on where the user points (this, that, these, those, here, there).
- **Anaphor:** a word that refers back to something already discussed (it, them, again).
- **Referent / binding:** the object, set of objects or place a word resolves to.
- **tWord:** the estimated time (ms) at which a deictic word was spoken.
- **Evidence:** a score per candidate object, accumulated from pointer samples near tWord.
- **Event log:** the ordered, timestamped list of all input events. The engine's only input.

## Requirements

### Requirement 1: Event log and determinism

**User story:** As a developer, I want every input to be a timestamped event folded by a pure function, so that any session can be replayed, explained and tested.

1. THE SYSTEM SHALL accept input only as `HocusEvent` values carrying their own timestamp `t`.
2. THE SYSTEM SHALL expose `step(state, event) -> { state, effects }` that does not mutate its inputs.
3. WHEN the same event log is folded twice from the same initial state, THE SYSTEM SHALL produce identical states, effects and decisions.
4. WHEN the first n events are folded, THE SYSTEM SHALL produce the same state as stepping one event at a time n times.
5. THE SYSTEM SHALL NOT read the wall clock or an unseeded random source inside `packages/core`.
6. WHEN an event fails schema validation at the boundary, THE SYSTEM SHALL reject it with an error naming the bad field and SHALL NOT change state.

### Requirement 2: Binding pointing words to objects

**User story:** As a user, I want "that" to mean what I was pointing at when I said it, so that I can talk to the app the way I talk to a person.

1. WHEN the user speaks a deictic word and an object was the pointer target for at least 250 ms within the 800 ms before it, THE SYSTEM SHALL bind the word to that object.
2. THE SYSTEM SHALL score each candidate as the sum over samples in `[tWord - 800, tWord + 300]` of `timeWeight * confidence * hitQuality * stability * dt`.
3. IF the two best candidates have evidence within 15% of the best, THEN THE SYSTEM SHALL ask the user to choose and SHALL NOT act.
4. WHEN no candidate reaches the minimum evidence and there is no explicit selection, THE SYSTEM SHALL reply "Point at something first" and SHALL NOT change the scene.
5. WHEN the pointer sweeps quickly across an object, THE SYSTEM SHALL weight those samples less than samples from a near-still dwell, so that a fast sweep never beats a stable dwell of equal duration.
6. WHEN shifting tWord by less than the tolerance (100 ms) keeps the same dominant dwell inside the window, THE SYSTEM SHALL return the same binding.
7. WHEN a command contains two or more deictic object words, THE SYSTEM SHALL bind them in spoken order, each with its own tWord, and SHALL NOT bind two words to the same object unless the action allows it.

### Requirement 3: Places, quantities and sets

**User story:** As a user, I want "there", "this big" and "these" to work, so that I can move, size and select things without menus.

1. WHEN a place word (here, there) is resolved, THE SYSTEM SHALL bind it to the pointer's surface point at the sample with the highest weighted stability near tWord.
2. WHEN a quantity phrase ("this big") is resolved, THE SYSTEM SHALL bind it to the mean hand aperture near tWord, in the range 0 to 1.
3. WHEN a plural word (these, those) is resolved and a lasso selection happened in the last 4 seconds, THE SYSTEM SHALL bind it to the lasso set.
4. WHEN a plural word is resolved without a lasso, THE SYSTEM SHALL bind it to every object that individually reaches the minimum evidence in the window, or to the explicit selection.
5. WHEN a lasso loop is closed, THE SYSTEM SHALL select exactly the objects whose projected area is at least 60% inside the loop.
6. WHEN the user says "every <kind>" or "all <kind>s", THE SYSTEM SHALL bind the set of all objects of that kind.

### Requirement 4: Discourse memory, names and type constraints

**User story:** As a user, I want "it" and names to carry over between commands, so that I do not have to point again for every step.

1. WHEN an anaphor (it, them) is used without fresh pointing evidence of at least `itOverrideEvidence`, THE SYSTEM SHALL bind it to the object(s) of the last executed action.
2. WHEN fresh pointing evidence is at least `itOverrideEvidence` and unambiguous, THE SYSTEM SHALL bind the anaphor to the pointed object instead.
3. WHEN the user says "call this one <Name>", THE SYSTEM SHALL record the name for the bound object, and later commands that mention the name SHALL bind to that object without pointing.
4. THE SYSTEM SHALL keep names unique: naming a second object with an existing name SHALL move the name and SHALL be undoable.
5. WHEN an action declares a required capability, THE SYSTEM SHALL consider only objects that have it; the filter SHALL only remove candidates.
6. WHEN the user asks "what was that?", THE SYSTEM SHALL answer with the label of the most recently dwelled-on object.

### Requirement 5: Safety, undo and repair

**User story:** As a user, I want to see what Hocus understood before it acts and to take anything back, so that mistakes are cheap.

1. WHEN a command resolves, THE SYSTEM SHALL enter a preview for 600 ms showing the interpreted command before executing it.
2. WHEN the user cancels during preview (Esc, "stop", open palm), THE SYSTEM SHALL discard the command and SHALL NOT change the document.
3. WHEN the user confirms during preview (Enter, "yes", thumbs-up), THE SYSTEM SHALL execute immediately.
4. WHEN the user says "undo", THE SYSTEM SHALL restore the exact previous document (app state and names); "redo" SHALL re-apply it.
5. IF an action is destructive and affects more than one object, or is a reset, THEN THE SYSTEM SHALL require an explicit confirmation and SHALL NOT execute on timeout.
6. WHEN the user says "no, the other one" after an action, THE SYSTEM SHALL undo it and re-execute with the next-best candidate for the first deictic slot.
7. WHEN the user says "not that", THE SYSTEM SHALL undo and exclude that candidate, then ask among the remaining candidates or report that none remain.
8. WHEN an ask is unanswered for 8 seconds, THE SYSTEM SHALL expire it quietly without acting.
9. WHEN the user answers an ask with a number, an ordinal ("the first one"), or by pointing again and saying "this one", THE SYSTEM SHALL bind that option and continue to preview.

### Requirement 6: Speech timing and self-calibration

**User story:** As a user with any speaking speed and network, I want Hocus to learn my delay, so that it binds the right object more often over time.

1. WHEN an interim transcript first contains the k-th deictic word of an utterance, THE SYSTEM SHALL set that word's tWord to the interim time minus the calibrated lag.
2. WHEN a final transcript contains deictic words never seen in interims, THE SYSTEM SHALL estimate their tWord by their relative position between speech start and the final event, minus the lag.
3. WHEN voice-activity segments are available, THE SYSTEM SHALL refine tWord by mapping word position onto the voiced timeline and averaging with the interim estimate.
4. WHEN a command is typed, THE SYSTEM SHALL use the Enter time as tWord with a 1.5 s look-back window, and SHALL bind multiple deictic words to the last distinct dwell segments in order, or to the explicit selection order.
5. WHEN the user corrects a binding with "no, the other one", THE SYSTEM SHALL move the lag estimate 30% toward the lag that would have made the chosen candidate win.
6. THE SYSTEM SHALL keep the lag estimate within [100, 1200] ms.

### Requirement 7: Explainability

**User story:** As a developer or judge, I want to see why Hocus chose a target, so that I can trust and tune it.

1. WHEN a frame is resolved, THE SYSTEM SHALL emit a `DecisionRecord` with the utterance, each word's tWord, every candidate's evidence and its parts, the parameters and the result.
2. THE SYSTEM SHALL keep the last 20 decision records in state for the X-ray view.
3. WHEN the same record's inputs are re-resolved with different parameters, THE SYSTEM SHALL return the decision those parameters imply, without side effects (live tuning).
