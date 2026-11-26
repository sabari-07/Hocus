# Requirements Document

Spec: room-designer

## Introduction

The Haunted Room Designer is App 1, a creative 3D editor built on the Hocus skeleton. The user decorates a
haunted room by pointing and talking: "put a pumpkin there", "make that bigger", "turn this green", "delete
these". The behaviour is the `defineApp` definition in `apps/room-designer/src/app.ts`; the 3D room is
`scene.ts` with procedural props from `models.ts`; `main.tsx` mounts the shell with a palette, nudge buttons and
a Judge Mode script. Parsing, binding, preview, undo, help and accessibility come from the skeleton.

## Glossary

- **Item:** one prop in the room: `id` (`<type>-<n>`), `type`, `n`, position `x, y, z`, `scale`, `rotation`, `tint`.
- **Catalog:** the 14 item types with label, mount, base size and whether they can be recoloured.
- **Mount:** where an item sits: `floor`, `wall` (the back wall) or `air` (floating).
- **Starter room:** a predefined room (`crypt`, `parlor`, `graveyard`).
- **Crypt palette:** the left panel with one button per item type.

## Requirements

### Requirement 1: Room model

**User Story:** As a user, I want a room full of named props I can point at, so that "that" always has something to mean.

#### Acceptance Criteria

1. THE SYSTEM SHALL hold the room as a list of items, a `lightsOn` flag and a per-type counter used for ids and numbers.
2. THE SYSTEM SHALL offer 14 item types: pumpkin, ghost, bat, candle, cobweb, coffin, lantern, dead tree, skeleton, black cat, cauldron, gravestone, spider and moon window.
3. THE SYSTEM SHALL start with the crypt starter room (8 items); the parlor and graveyard starters SHALL exist as data.
4. THE SYSTEM SHALL expose each item as a selectable labelled "<Label> <n>" with the capabilities `scalable`, `movable` and, for colourable types, `colorable`, plus its position and size for spatial words.
5. THE SYSTEM SHALL keep floor items at height 0, air items between 0.8 and 3.4, wall items on the back wall (z = −3.9), and clamp x and z to the floor area.

### Requirement 2: Adding and moving

**User Story:** As a user, I want to put new props where I point and move existing ones the same way, so that I can arrange the room without dragging.

#### Acceptance Criteria

1. WHEN the user says "put a pumpkin there" (or "add a bat here", "वहाँ एक कद्दू रखो", "அங்கே ஒரு பூசணி வை") while pointing at the floor or the back wall, THE SYSTEM SHALL add a new item of that type at the pointed spot, placed by its mount.
2. WHEN the user says "put it there" or "move that there", THE SYSTEM SHALL move the item to the pointed spot; floor items SHALL stay on the floor.
3. WHEN the user says "put it next to this", THE SYSTEM SHALL move the item to the position the resolver computes next to the reference item.
4. WHEN the user clicks a Crypt palette button, THE SYSTEM SHALL add that item near the centre of the room.
5. WHEN an item is selected and the user clicks a nudge button, THE SYSTEM SHALL move it 0.8 units left, right, back or forward.

### Requirement 3: Editing props

**User Story:** As a user, I want to resize, rotate, recolour and copy props by voice, so that decorating is quick.

#### Acceptance Criteria

1. WHEN the user says "make that bigger" or "make this smaller", THE SYSTEM SHALL multiply the item's scale by the factor (default 1.25), clamped to [0.25, 4].
2. WHEN the user says "make it this big" while showing a size with thumb and finger, THE SYSTEM SHALL set the scale to `0.4 + 2.6 × aperture`, clamped to [0.25, 4].
3. WHEN the user says "rotate that", THE SYSTEM SHALL turn the item by 45 degrees.
4. WHEN the user says "turn this green" or "paint that purple", THE SYSTEM SHALL tint the item; cobwebs, dead trees, skeletons and moon windows SHALL NOT be recolourable.
5. WHEN the user says "duplicate this", THE SYSTEM SHALL add a copy of the same type offset by 0.9 in x and 0.3 in z, with the same scale, rotation and tint.
6. WHEN the user says "bring that to the front" or "send that to the back", THE SYSTEM SHALL move the item 1 unit toward or away from the viewer.

### Requirement 4: Deleting, lights, questions and reset

**User Story:** As a user, I want to clear things, change the mood and start over safely, so that mistakes are cheap.

#### Acceptance Criteria

1. WHEN the user says "delete that", "delete these" or "delete every bat", THE SYSTEM SHALL remove the items; removing more than one SHALL need confirmation (destructive action).
2. WHEN the user says "lights off" or "lights on", THE SYSTEM SHALL switch the room lights; with the lights off the room SHALL dim and props with glow materials (for example candles, pumpkins and lanterns) SHALL glow brighter.
3. WHEN the user asks "what is that?", THE SYSTEM SHALL answer "That is <label>." without adding an undo step.
4. WHEN the user says "start over" or clicks "Start over", THE SYSTEM SHALL always ask for confirmation and then restore the crypt starter room.

### Requirement 5: Three languages

**User Story:** As a Hindi or Tamil speaker, I want the same commands in my language, so that I can decorate without English.

#### Acceptance Criteria

1. THE SYSTEM SHALL give every action trigger phrases and Spellbook examples in `en`, `hi` and `ta`, and every item type nouns in all three languages, with no lexicon lint errors.
2. WHEN any Spellbook example is parsed in its language, THE SYSTEM SHALL get that example's own action.
3. THE SYSTEM SHALL give every selectable a unique id and a unique label.

### Requirement 6: The 3D room

**User Story:** As a user, I want a room that looks alive and reacts to my commands, so that the result is worth sharing.

#### Acceptance Criteria

1. THE scene SHALL build a floor, a back wall and side walls, register the floor and the back wall as placement surfaces, and register every item with the stage for pointing.
2. WHEN the document changes, THE scene SHALL add, update and remove item models, ease them to their new position, scale and rotation, and apply or clear tints.
3. WHEN an action executes, THE scene SHALL play a particle burst on the acted-on items unless reduced motion is on; with reduced motion, changes SHALL be instant and props SHALL not animate.
4. WHEN the user clicks "Export PNG", THE SYSTEM SHALL download a PNG snapshot of the room.
5. THE app SHALL ship an 8-step Judge Mode script (bigger, put it there, green, naming, use the name, add a bat, lights off, lights on).
6. THE behaviour file `src/app.ts` SHALL stay within the 300-line budget.
