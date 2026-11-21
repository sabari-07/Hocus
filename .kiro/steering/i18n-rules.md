---
inclusion: fileMatch
fileMatchPattern: ["packages/core/src/lexicon/**", "apps/**/src/app.ts", "examples/**/src/app.ts", "packages/ui/src/i18n/**"]
---

# Language rules

- **Lexicon packs are data only** (`packages/core/src/lexicon/<lang>.ts`). No functions, no regexes with logic.
  Adding a language = adding a data file + registering it in `lexicon/index.ts`.
- The parser is **order-independent slot filling**, so packs never encode word order.
  Hindi is SOV and Tamil is SOV and agglutinative: list inflected forms (e.g. Tamil `இதை`, `இதைப்`, `இது`).
- Every action an app defines must have trigger phrases in **every shipped language** (`en`, `hi`, `ta`).
  `lint_lexicon` (MCP tool and `npm run lexicon:lint`) fails on gaps.
- A phrase must not map to two different actions inside one pack unless the action resolver can split them by
  slot shape (for example `put` -> `place` when an entity noun follows, `move` when an object reference follows).
  Flag every other collision.
- Interface strings live in `packages/ui/src/i18n/*.ts`, never inside lexicon packs.
- Hindi and Tamil wording was drafted with AI help and **must be reviewed by a native speaker** before the demo.
  Record the reviewer and date in `docs/kiro-journal.md`.
- Recognizer language codes: `en-US`/`en-IN`, `hi-IN`, `ta-IN`.
