# Judging audit: where Hocus is weak, and what changed

Written 2026-11-26. Everything marked **verified** was read from a source or measured in this repo. Everything marked
**judgement** is my opinion, not data. Scores are not given: nobody outside the judging panel can know them.

## What I could and could not check

| Source | Result |
|---|---|
| [AWS Japan summary of the official Kiroween 2026 rules](https://aws.amazon.com/jp/blogs/news/kiroween-2026/) (dates, categories, submission items, prizes, five judging criteria) | **verified**, read in full |
| `kiroween.devpost.com` (Rules, FAQ, Resources, Gallery) | **could not open**: Devpost returns HTTP 403 to my fetcher. Re-read the English rules yourself before submitting |
| Kiroween 2025 winners list | **could not retrieve** (gallery 403, no results page found). The only 2025 winner I could verify is **InteractionKit**, the Grand Prize, from its [GitHub README](https://github.com/Harpita-P/Kiro-InteractionKit) |
| Kiroween 2025 judging criteria and categories | **verified** from [Kiro's launch post](https://kiro.dev/blog/kiroween-2025/) |

## What InteractionKit did well (verified from its README)

- A **skeleton with two finished, fun products**: a pumpkin-slicing maths game (Math-O-Lantern) and a lightboard
  recorder (Holo-Board) that exports a video. Both are instantly understood and one is playable in seconds.
- A **large ready-made gesture vocabulary** (hand, head and face: pinch, fist, peace, nods, tilts, blink, smile).
- Kiro depth shown plainly: hooks that generate missing gestures, steering for architecture, Context7 MCP, spec workflow.

## Hocus against the five 2026 criteria (each 20%)

| Criterion | What Hocus has | Weak point found | What changed this round | Still open |
|---|---|---|---|---|
| **Potential impact** | Hands-busy, touchless-kiosk, hands-free and Hindi/Tamil users; keyboard parity tested (P13) | "Why not just click?" is not answered on screen | The landing diagram now shows the one problem Hocus solves (text arrives late, the finger has moved). Head nod/shake completes a truly hands-free path | Say the user in the first 30 s of the video. A real accessibility user test would be the strongest evidence and does not exist |
| **Technological implementation (Kiro)** | 10 specs, 8 steering files, 8 hooks, 3 agents, MCP server, Power, Crew app, 22 properties (27 tests), mutation testing | Kiro's own validator rejected the spec files; mutation score on the resolver is only 46% | **All 30 spec files now pass `validate_spec_format`**. Specs extended for live preview (fusion-engine 7.4-7.6) and head gestures (pointer-input 7) | The resolver score (46%). IDE vs CLI vs Web notes in the write-up are yours to write |
| **Design** | Rebuilt this round | The old UI was a dashboard: header bar, two sidebars, footer, canvas in the middle. It looked like any admin page and hid the 3D world | Full-bleed 3D stage with floating glass panels, a speech dock, per-app identity (candle, observatory, board), emoji tile palette, data visualisation in the planet panel, cinematic landing | Needs your eyes on a real screen and a real camera. Not tested with a person |
| **Innovation / idea** | Language plus pointing as a reusable skeleton; velocity-aware dwell; self-calibration; live explanation | The explanation lived in a hidden X-ray panel, so most judges would never see why a binding was chosen | The explanation is now **in the scene**: a curved thread from each spoken word to the object it bound to, a dashed ghost preview while you are still speaking, a glow on the object "that" would mean right now, a confidence meter on each word chip | No second system to compare against. The benchmark compares Hocus to simple baselines on **simulated** users only |
| **Presentation** | Video script, Judge Mode, README | No screenshots in the repo; the 10-second opening needed a camera | README now has screenshots. Judge Mode plays the real engine with progress dots. Landing explains the idea without a video | The video itself is not made. See `docs/video-script.md` |

## Requirement and eligibility checks

| Rule | Status |
|---|---|
| New project built 30 Oct to 4 Dec 2026 | Repo history starts in November 2026 (`git log`). **Fine.** No code is reused from earlier projects |
| Public GitHub repo with an open-source licence shown in About | Pushed to `sabari-07/Hocus`. MIT file exists. **You must check the repo is public** and that GitHub shows the licence |
| `/.kiro` at the root and not ignored | **Yes** (`git check-ignore .kiro` returns nothing, 40+ tracked files) |
| Skeleton Crew: two distinct apps in separate folders | `apps/room-designer`, `apps/planet-explorer`; third app in `examples/kitchen-board`. **Weak point**: both were visually the same shell. They now differ in theme and information design, but both are still "a 3D scene you point at" |
| Working app URL | **Not done.** Needs a hosting account (see below) |
| Demo video under 3 minutes, public YouTube, shows it running on your machine | **Not done** |
| Kiro write-up | Draft in `docs/writeup.md`. The sections marked "(you)" need your own words |
| English submission, translations if not English | English. Hindi and Tamil are features, not the submission language |
| Disclose pre-existing code | Only npm dependencies and MediaPipe models (Apache-2.0). Fonts are SIL OFL via Fontsource. All 3D props are procedural |
| Camera and mic over HTTPS | Needs the deployment above. `localhost` works without it |

## Weak points still open, in order of risk

1. **No real-camera validation (high).** Hand pointing has only been exercised with a real *mouse* over the 3D scene and
   with synthetic samples. Lighting, distance, handedness and the pad size are untested on real hands. Only you can test this.
2. **No live URL (high).** Judges must open an app. Without it the submission is incomplete.
3. **The apps are demos, not products (medium, judgement).** InteractionKit shipped a playable game and a recording
   tool. The quiz in the Planet Explorer is the closest thing to a game loop, and the Room Designer has export-to-PNG.
   A challenge mode in the room ("haunt this room in 60 seconds" with a score) would close most of this gap.
4. **Hindi and Tamil unreviewed (medium).** A wrong word in the demo costs credibility with exactly the audience the feature is for.
5. **All replay files are synthetic (medium).** The replays are labelled synthetic, but a recorded session is a stronger proof.
6. **Resolver mutation score 46% (low to medium).** Documented in `docs/mutation.md`; it is a measured limit, not a claim.
7. **Performance on weak GPUs (low, untested).** Bloom, outlines and auras are all on. There is no "lite" quality setting.

## Bugs this redesign surfaced (all fixed, all in `docs/kiro-journal.md`)

- Negative frame time made the smoothing function extrapolate: a pumpkin reached a scale of **-2,421,190** on a 1024×768
  screen and the room rendered as black polygons. Fixed in `Stage` and `damp`, found by looking at a tablet screenshot.
- A lost WebGL context left a blank white stage with no explanation. Now a message appears and the view recovers
  (`tests/e2e/apps.spec.ts`).
- On a phone the toolbar ran off the edge, hiding three buttons, and the dock was 207 px tall.
- A portrait screen cropped the room to a window and a pumpkin; the camera now widens its field of view.

## What I need from you

| Item | Why |
|---|---|
| A hosting account: **AWS Amplify** (config is in `amplify.yml`), or Netlify / Vercel / Cloudflare Pages | The live URL. Camera and mic need HTTPS. I cannot create accounts or enter credentials |
| Three project URLs set as `VITE_ROOM_URL`, `VITE_PLANETS_URL`, `VITE_KITCHEN_URL` | So the landing cards link to each other |
| A native Hindi speaker and a native Tamil speaker (or drop those from the video) | Review `packages/core/src/lexicon/hi.ts`, `ta.ts` and the app vocabularies |
| 20 minutes with your own webcam and mic | Real-hand test; record 3 to 5 sessions with the X-ray Recorder into `tests/replays/` |
| A YouTube channel | The demo video must be public there |
| Kiro hackathon credits (form closes **1 Dec, 12:00 PM PT**) | Free credits for the last days of building |
| `.kiro/settings/mcp.json` | Kiro blocks me from writing it. Copy `docs/mcp.example.json` to that path |
| A Context7 API key (optional) | Only if you want its docs MCP server; Hocus works without it |
| Decision: add the "haunt this room" challenge mode? | It is the biggest remaining product gap (item 3). About a day of work |
