# Requirements: planet-explorer

## Introduction

Point & Ask Planet Explorer is App 2, a touchless 3D solar system for exhibits and classrooms, built on the Hocus
skeleton. The visitor points at a moving planet and asks "what is that?", "how far is this from the sun?" or
"compare this with that", and can play a quiz by pointing and saying "that one". The behaviour is
`apps/planet-explorer/src/app.ts`; the facts are data in `src/data/solar-system.json` (NASA NSSDCA Planetary Fact
Sheet, retrieved 2026-11-22); `scene.ts` draws the orbits and `main.tsx` mounts the shell with an information
panel and a Judge Mode script.

## Glossary

- **Body:** one entry of the data file: the Sun, the eight planets or the Moon, with diameter, distance, day, year, moons, mean temperature, colour and a fact.
- **Sky:** the app state: `info`, `compare`, `focus`, `trueScale`, `speed`, `moonsOf`, `quiz`.
- **Readable scale / true scale:** two layouts, one spaced for pointing, one proportional to real distances and sizes.
- **Quiz:** a cycle of 8 questions answered by pointing at a body.

## Requirements

### Requirement 1: Bodies and facts

**User story:** As a visitor, I want correct numbers with a source, so that I can trust what the exhibit tells me.

1. THE SYSTEM SHALL load 10 bodies (Sun, Mercury, Venus, Earth, Moon, Mars, Jupiter, Saturn, Uranus, Neptune) and the quiz from `src/data/solar-system.json`.
2. THE data file SHALL name its source (NASA NSSDCA Planetary Fact Sheet, metric, and the Sun fact sheet), the source URLs and the retrieval date (2026-11-22), and note that moon counts change and that the Moon's distance is from Earth.
3. THE SYSTEM SHALL show the source name, link and retrieval date in the information panel, and SHALL include the retrieval date when it reports moon counts.
4. THE SYSTEM SHALL expose each body as a selectable labelled with its name, with the capabilities of its kind (`star`, `planet`, `moon`), `orbits` for planets and the Moon, and `hasMoons` for planets.

### Requirement 2: Asking about one body

**User story:** As a visitor, I want to point and ask about a planet, so that I learn without touching anything.

1. WHEN the user asks "what is that?" or "tell me more about this", THE SYSTEM SHALL show the body in the panel and answer with its diameter, distance (from the Sun, or from Earth for the Moon), number of moons and its fact.
2. WHEN the user asks "how far is this from the sun?", THE SYSTEM SHALL answer with the distance; the Sun SHALL NOT be a candidate (it has no `orbits`).
3. WHEN the user asks "how big is that?", THE SYSTEM SHALL answer with the diameter and the ratio to Earth.
4. WHEN the user says "show its moons" or "how many moons does this have?", THE SYSTEM SHALL show up to 14 small moons around the planet and say the known moon count; only planets SHALL be candidates.
5. WHEN the user says "zoom in on that", THE SYSTEM SHALL fly the camera to the body.

### Requirement 3: Comparing two bodies

**User story:** As a visitor, I want to compare two planets by pointing at each, so that sizes make sense.

1. WHEN the user says "compare this with that" while pointing at one body and then another, THE SYSTEM SHALL bind the two words in spoken order to two different bodies.
2. THE SYSTEM SHALL answer "<bigger> is <n> times wider than <smaller>." and show a table of diameter, distance, day, year and moons for both.
3. IF both words would bind to the same body, THEN THE SYSTEM SHALL NOT compare it with itself (`distinct`).

### Requirement 4: View controls

**User story:** As a visitor, I want to change speed and scale, so that I can see the system the way that helps me.

1. WHEN the user says "spin faster" or "slow down", THE SYSTEM SHALL double the orbit speed (up to 64×) or halve it (to 0 below 0.1×).
2. WHEN the user says "true scale on" or "true scale off", THE SYSTEM SHALL switch between the readable layout and the proportional layout.
3. WHEN the user says "reset", THE SYSTEM SHALL return to the overview with default speed and scale and SHALL keep a running quiz.
4. WHILE the pointer rests on any body, THE scene SHALL slow orbits to 15% so that moving targets are easier to hold.
5. THE view actions SHALL NOT add undo steps (`mutates: false`); buttons in the top bar and the panel SHALL offer true scale, quiz, slower, faster and reset.

### Requirement 5: Quiz by pointing

**User story:** As a classroom student, I want to answer quiz questions by pointing, so that the exhibit is a game.

1. WHEN the user says "start the quiz", THE SYSTEM SHALL start at question 1 with score 0 and read the question.
2. WHEN the user points at a body and says "that one" (or "the answer is this", "यह वाला", "இதுதான்"), THE SYSTEM SHALL run the `answer` action through the app's `pointAction`, mark it right or wrong, give the hint when wrong, read the score and the next question.
3. WHEN there is no quiz running, THE SYSTEM SHALL treat an answer as "what is that?" and describe the body.
4. WHEN the user says "quiz off", THE SYSTEM SHALL end the quiz.

### Requirement 6: Languages, scene and budget

**User story:** As a Hindi or Tamil speaking visitor, I want to ask in my language, and as a maintainer I want the app to stay small.

1. THE SYSTEM SHALL give every action trigger phrases and Spellbook examples in `en`, `hi` and `ta`, with no lexicon lint errors, and every example SHALL parse to its own action.
2. THE scene SHALL draw the Sun, planets with banded textures, Saturn's ring, Uranus's tilt, orbit lines and the Moon around Earth, register every body with a pick radius of 1.15, and show name chips for the focused, described or compared bodies.
3. WHEN an action executes, THE scene SHALL play a teal burst on the acted-on bodies unless reduced motion is on; with reduced motion, orbits and spins SHALL stop and camera moves SHALL be instant.
4. THE app SHALL ship an 8-step Judge Mode script (what is that, compare, zoom, its moons, reset, start the quiz, answer).
5. THE behaviour file `src/app.ts` SHALL stay within the 300-line budget.
