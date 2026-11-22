# Requirements: speech-input

## Introduction

Speech input turns the user's voice (or typed text) into timestamped `speech` events, and estimates when each
pointing word was spoken, because browsers give text but no per-word times. It also reads answers back, plays
short sound cues and, optionally, asks Chrome's on-device language model to rewrite a phrase the parser did not
understand. It lives in `packages/speech` (`recognizer.ts`, `vad.ts`, `output.ts`, `proposer.ts`), the pure
timing math in `packages/core/src/timing.ts`, and the wiring in `packages/ui` (runtime, speech bar, keyboard map).

## Glossary

- **Push-to-talk:** listening only while Space or the mic button is held.
- **Interim / final transcript:** partial recognizer results while speaking, and the last result of an utterance.
- **Timed word:** a deictic or anaphor word whose time is needed for binding.
- **First-seen time:** the time of the first interim that contained the k-th timed word.
- **Lag:** the calibrated delay between saying a word and seeing it in an interim (`lagMs`, default 350 ms).
- **VAD segment:** a stretch of time when the microphone level was above the voice threshold.
- **Proposer:** the optional rewrite step that uses Chrome's Prompt API (`LanguageModel`).
- **Alternative transcript:** another reading of the utterance (`alts`), tried only if the best one is not understood.

## Requirements

### Requirement 1: Push-to-talk recognition

**User story:** As a user, I want to hold a key or a button while I speak, so that Hocus only listens when I mean it.

1. WHEN the user holds Space outside a text field, or presses the mic button, THE SYSTEM SHALL start Web Speech recognition in the current pack's language code (`en-US`, `hi-IN`, `ta-IN`) with interim results and up to 3 alternatives, and emit a `start` speech event.
2. WHEN the user releases Space or the button, THE SYSTEM SHALL stop the recognizer and let it deliver its final result; THE SYSTEM SHALL emit `end` when the recognizer ends.
3. THE SYSTEM SHALL emit `interim` events with the best transcript, and `final` events with the best transcript, the other alternatives (`alts`) and the VAD segments (`vad`), all timestamped with the same clock as pointer samples.
4. IF the browser has no SpeechRecognition, THEN THE SYSTEM SHALL report `unsupported`, disable the mic button and keep the typed box working.
5. IF permission is refused (`not-allowed`, `service-not-allowed`), THEN THE SYSTEM SHALL report `denied` and show a toast; `no-speech` and `aborted` SHALL NOT be treated as errors.
6. WHERE "always listening" is on, THE SYSTEM SHALL restart recognition 150 ms after it ends and SHALL act only on utterances whose first word is the wake word `hocus`.

### Requirement 2: Word timing

**User story:** As a user, I want Hocus to know when I said "that", so that it looks at where I was pointing at that moment and not at the end of the sentence.

1. WHEN an interim transcript first contains the k-th timed word, THE SYSTEM SHALL record that interim's time as the word's first-seen time and SHALL never change it afterwards.
2. THE SYSTEM SHALL estimate a seen word's time as first-seen − lag, but not earlier than the speech start.
3. WHEN a timed word was never seen in an interim, THE SYSTEM SHALL place it at its relative token position `(i + 0.5) / n` between the speech start and `final − lag`.
4. WHEN VAD segments exist, THE SYSTEM SHALL map the same relative position onto the voiced time inside [start, final] and average it with the interim estimate, or use it alone when there is no interim estimate.
5. THE SYSTEM SHALL never place a word after the final event, and SHALL assume the speech started 2 s before the final event when no start was seen.
6. THE SYSTEM SHALL report, for each word, the method used (`interim`, `position`, `vad`, `interim+vad`) and the raw first-seen time, for self-calibration.

### Requirement 3: Voice-activity detection

**User story:** As a user, I want Hocus to hear when I actually spoke, so that word times are right even when interims arrive late.

1. WHILE recognition is running, THE SYSTEM SHALL measure the microphone RMS level every animation frame with a Web Audio analyser (512 samples), on the device.
2. THE SYSTEM SHALL count a frame as voiced when RMS is above `max(0.015, 3 × noise floor)`, and SHALL adapt the noise floor slowly on quiet frames.
3. THE SYSTEM SHALL close a segment after 120 ms of quiet and SHALL drop segments shorter than 60 ms.
4. WHEN onboarding sees the first pointing word in an interim, THE SYSTEM SHALL set the lag to that time minus the first VAD onset, clamped to [100, 1200] ms.
5. IF the microphone cannot be opened for VAD, THEN THE SYSTEM SHALL continue without segments.

### Requirement 4: On-device recognition and privacy

**User story:** As a privacy-minded user, I want to know whether my speech leaves the device, and to keep it local when the browser can.

1. WHEN the app loads or the language changes, THE SYSTEM SHALL call `SpeechRecognition.available({ langs, processLocally: true })` and record the privacy as `on-device` when it answers `available`, else `cloud`.
2. WHERE on-device recognition is available, THE SYSTEM SHALL set `processLocally = true` on each new recognizer.
3. THE SYSTEM SHALL show in Settings whether speech is processed on the device or in the cloud, and SHALL offer "Try on-device speech" (`SpeechRecognition.install`) when it is not on the device.
4. IF the availability API is missing or throws, THEN THE SYSTEM SHALL report `cloud`.

### Requirement 5: Typed fallback

**User story:** As a user without a microphone, or in a noisy room, I want to type the same commands, so that I can still use every feature.

1. THE SYSTEM SHALL always show a labelled text box in the speech bar; WHEN it is submitted, THE SYSTEM SHALL emit a `typed` speech event with the trimmed text and the submit time, and SHALL ignore empty text.
2. WHEN a command is typed, THE SYSTEM SHALL use the submit time as the time of every pointing word (fusion-engine 6.4).
3. THE SYSTEM SHALL NOT require the wake word for typed commands.
4. WHILE focus is in a text field, THE SYSTEM SHALL NOT treat Space as push-to-talk.

### Requirement 6: Read-back and sound cues

**User story:** As a user who is not looking at the screen, I want to hear answers and short sounds, so that I know what happened.

1. WHERE voice feedback is on (it is off by default), THE SYSTEM SHALL speak each `speak` effect with `speechSynthesis` in the pack's language, choosing a voice whose language starts with the same two letters and cancelling any speech still playing.
2. THE SYSTEM SHALL speak only `speak` effects (action replies and "what was that?"); all other announcements SHALL go to the live regions.
3. WHERE sounds are on (the default), THE SYSTEM SHALL play short synthesized tones for `lock`, `run`, `cancel`, `ask` and `error`, without audio files.

### Requirement 7: Optional on-device proposer

**User story:** As a user who phrases things freely, I want an on-device model to map my words to a known command, without it ever deciding what I pointed at.

1. WHERE the proposer setting is on and the Prompt API reports `available`, THE SYSTEM SHALL ask the proposer for a rewrite of a final transcript only when that transcript parses to `no_action`.
2. THE SYSTEM SHALL give the proposer only the app's example commands for the current language as the allowed list, and SHALL abort the request after 1500 ms.
3. THE SYSTEM SHALL validate the reply with a Zod schema (`{ command: string, at most 120 characters }`) and SHALL accept it only if it equals one of the allowed examples after normalizing case, punctuation and spaces.
4. WHEN a rewrite is accepted, THE SYSTEM SHALL pass it as the first alternative transcript; the engine SHALL try alternatives only when the best transcript is `no_action`, and SHALL bind every pointing word from pointer evidence itself.
5. THE proposer SHALL NOT choose a referent or execute anything, and any failure (no API, timeout, bad JSON, not in the list) SHALL give no rewrite.
