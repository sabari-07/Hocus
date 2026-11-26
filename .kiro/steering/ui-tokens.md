---
inclusion: fileMatch
fileMatchPattern: ["packages/ui/**", "packages/three/**", "packages/devtools/**", "apps/**", "examples/**"]
---

# Design tokens: "ink and candlelight"

Source of truth: `packages/ui/src/styles/tokens.css`. Use the CSS variables, never raw hex in components.
In three.js code import the same values from `packages/three/src/palette.ts`.

| Token | Value | Use |
|---|---|---|
| `--hx-bg` | `#0E0B14` | page background, scene clear color |
| `--hx-panel` | `#1A1426` | raised panels |
| `--hx-overlay` | `rgba(14, 11, 20, 0.82)` | sheets and dimming |
| `--hx-text` | `#EDEAF7` | body text |
| `--hx-muted` | `#B9B2D0` | secondary text |
| `--hx-amber` | `#FFB347` | Wisp pointer, main accent, "tracking" |
| `--hx-teal` | `#4FE3C1` | locked on, success |
| `--hx-violet` | `#8E7CFF` | hover, information |
| `--hx-red` | `#FF5D73` | destructive only |

- **Type:** Cinzel (titles only), Inter (interface), JetBrains Mono (X-ray timestamps). Scale 12/14/16/20/24/32/48.
  Fonts are self-hosted through `@fontsource/*`.
- **Spacing:** 4 px grid. Radii 8 and 16 px. Chips are pills.
- **Glow:** `0 0 24px rgba(255, 179, 71, 0.35)`.
- **Motion:** 120 ms micro, 200 ms state, 320 ms panels, easing `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- **High-contrast theme:** `[data-theme="contrast"]` uses pure white on black and thicker outlines.
- **3D outlines:** hover = violet, locked = teal, ambiguous candidates = amber with numbered badges.
- Spooky decoration outside, plain readable controls inside.

## Immersive shell (added with the redesign)

- The 3D stage fills the viewport. Panels, the HUD and the speech dock **float over it as glass** (`.hx-glass`: translucent
  panel colour, 1 px line, 16 px blur). No full-height sidebars, no header or footer bar.
- `--hx-accent` is the per-app accent (default amber; `data-app="observatory"` = teal; `data-app="board"` = cream). Use it
  for app identity. The Wisp pointer stays amber in every app.
- Overlays never count as pointing: only the canvas and label layer do (the pointer hub checks the event target).
- Anything that explains a decision belongs **in the scene** (spell threads, evidence glow, numbered ask badges), not only
  in the X-ray panel.
- Every new toolbar button needs an accessible name that survives the narrow-screen label hiding (hide labels visually,
  never with `display: none`).
