# Hocus

**Point. Speak. Done.**

Hocus is an open-source TypeScript skeleton for web apps that understand pointing words. Point at something with
your finger, your head, a mouse or touch, and say what you want: *"make **that** bigger"*, *"put **it there**"*,
*"compare **this** with **that**"*. Hocus works out what "that" and "there" meant at the moment you said them, shows
you its interpretation, and only then acts.

Built with Kiro for **Kiroween 2026 · Skeleton Crew**: one lean skeleton, three different 3D apps built on it.

| App | What it is | Behaviour code (`src/app.ts`) |
|---|---|---|
| [Haunted Room Designer](apps/room-designer) | Decorate a 3D haunted room by pointing and talking | 223 lines |
| [Point & Ask Planet Explorer](apps/planet-explorer) | A touchless 3D solar system exhibit with a quiz | 208 lines |
| [Recipe Board](examples/kitchen-board) | Hands-free recipe cards; the reuse proof, built from one spec | 82 lines |

Line counts come from `npm run app-size` (`docs/app-size.md`).

## Try it in 30 seconds

```bash
npm install
npm run models        # self-hosts the MediaPipe model + WASM (12 MB download, once)
npm run dev:room      # http://localhost:5281
npm run dev:planets   # http://localhost:5282
npm run dev:kitchen   # http://localhost:5283
```

- **No camera or microphone?** Press **▶ Judge Mode**: a scripted session runs through the real engine and the
  real 3D hit testing, with captions. Press **Your turn** to take over.
- **Mouse and keyboard only:** hover an object (or click it in the Scene list) and type *make that bigger* in the
  box at the bottom. Everything has a keyboard path.
- **With a camera:** *Start with camera*, point with your index finger, hold **Space** and speak.
- Use desktop Chrome for speech. Hindi (हिन्दी) and Tamil (தமிழ்) are in Settings → Language.

## How it works

```
SENSE                 UNDERSTAND            FUSE                        ACT                SHOW
hand / head / mouse → speech or typing  →  bind "that" and "there"  →  pure reducer   →  outlines, chips,
hit test at capture   becomes a frame      from pointer evidence at     (undoable)        X-ray of the decision
                                           the time each word was said
```

1. **Pointer samples** arrive 30 times a second. Each sample freezes what was under the pointer *then* (planets
   move).
2. **Word times.** The browser gives text without word timestamps, so Hocus records when an interim transcript
   first contains each pointing word and subtracts a calibrated lag. Our own voice-activity detection refines it.
3. **Evidence.** Each candidate scores `Σ timeWeight · confidence · hitQuality · stability · dt` in a window
   around the word. Fast sweeps count less than a steady dwell.
4. **Never guess.** Too little evidence gives "Point at something first". Two close candidates give *"Did you mean 1
   or 2?"*. Destructive actions on several things ask for confirmation.
5. **Preview, then act.** The command is shown for 600 ms with Cancel. *"undo"*, *"no, the other one"* and
   *"not that"* repair mistakes, and each correction tunes the lag estimate.

Details: [`docs/architecture.md`](docs/architecture.md) and the fusion spec in
[`.kiro/specs/fusion-engine/`](.kiro/specs/fusion-engine/).

## What an app writes

```ts
export const roomApp = defineApp<Room>({
  id: 'room-designer',
  initialState,
  selectables: (s) => s.items.map((i) => ({ id: i.id, label: `${CATALOG[i.type].label} ${i.n}`, kind: i.type, caps: [...] })),
  actions: {
    scale: { slots: { target: 'object', factor: 'factor' }, defaults: { factor: 1.25 }, requires: 'scalable',
             reduce: (s, a) => update(s, a.target, (i) => ({ ...i, scale: i.scale * a.factor })) },
    recolor: { slots: { target: 'object', color: 'color' }, requires: 'colorable', reduce: ... },
  },
  vocabulary: { en: { nouns: { pumpkin: ['pumpkin', 'pumpkins'] } }, hi: { ... }, ta: { ... } },
});
```

plus a three.js scene that calls `stage.register(id, mesh)`. Tracking, speech, parsing, fusion, preview, ask,
undo, replay, X-ray, Spellbook, settings, onboarding and accessibility come from the skeleton.

New app: `node tools/create-hocus-app/src/index.mjs my-app "My App"` (creates `examples/my-app/` and a passing test).

## Repository

```
.kiro/       specs (10), steering (8), hooks (8 in 2 files), agents (3), skills
packages/    core · input · vision · speech · three · ui · devtools · testkit
apps/        room-designer · planet-explorer
examples/    kitchen-board
tools/       hocus-mcp (MCP server) · create-hocus-app (scaffolder)
power/       Kiro Power (plugin.json, mcp.json, skill)
crew/        Kiro Crew app: nightly soak tester (publish as its own repo)
tests/       unit · properties (P01–P20) · replays · e2e (Playwright + axe)
docs/        architecture · kiro-journal · benchmark · app-size · write-up · video script · submission checklist
```

## Quality

| Check | Command | Status in this repo |
|---|---|---|
| Determinism lint (no clock/random/DOM in core) | `npm run lint` | passing |
| Typecheck (strict) | `npm run typecheck` | passing |
| Unit tests | `npm run test:unit` | 56 passing |
| Property tests P01–P20 (100 cases each) | `npm run test:props` | 23 passing |
| Sabotage mutants (each killed by its property) | `node scripts/sanity-mutants.mjs` | 7 of 7 killed |
| Replay corpus | `npm run test:replays` | 7 passing (synthetic sessions) |
| E2E + axe (no serious/critical issues) | `npm run test:e2e` | 9 passing |
| Mutation testing (fusion math) | `npm run test:mutation` | see `docs/mutation.md` |
| Benchmark vs baselines (simulated users) | `npm run bench` | see `docs/benchmark.md` |

## Kiro

How Kiro was used, with file paths: [`docs/writeup.md`](docs/writeup.md). What Kiro got wrong and what caught it:
[`docs/kiro-journal.md`](docs/kiro-journal.md).

- **Specs:** 10 feature specs in `.kiro/specs/`, EARS requirements, design with a correctness-property table, tasks.
- **Steering:** 8 files (`product`, `tech`, `structure`, `fusion-rules`, `a11y`, `ui-tokens`, `i18n-rules`, `testing`).
- **Hooks:** determinism, fast properties, lexicon lint, replay regression, axe smoke, requirements re-analysis,
  action parity, turn-end gate (`.kiro/hooks/*.json`).
- **Agents:** `fusion-reviewer`, `a11y-auditor`, `linguist-reviewer` (read-only).
- **MCP:** `hocus-mcp` lets Kiro run the real engine (`resolve`, `replay`, `explain`, `lint_lexicon`). Example
  workspace config: [`docs/mcp.example.json`](docs/mcp.example.json); copy it to `.kiro/settings/mcp.json`.
- **Power:** `power/` bundles the MCP server and a skill. **Crew:** `crew/hocus-soak-tester/`.

## Privacy

Camera frames are processed on your device and never uploaded. Speech uses your browser's recognizer, which in
Chrome is a cloud service unless on-device recognition is available (Settings shows which). No analytics.

## Honest limits

- Speech word timing is estimated, not measured per word. Hocus asks when unsure instead of guessing.
- Hindi and Tamil word lists were drafted with AI help and **still need native-speaker review**.
- All replay files are synthetic until real sessions are recorded. Benchmark numbers are from simulated users.
- Pointing at a 3D object depends on lighting and camera quality. The mouse, touch and keyboard paths always work.

## Licence

MIT. Planet data: NASA NSSDCA Planetary Fact Sheet (retrieved 2026-11-22). Models: MediaPipe (Apache-2.0).
Fonts: Cinzel, Inter, JetBrains Mono (SIL OFL) via Fontsource. All 3D props are procedural; no third-party assets.
