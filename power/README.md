# Hocus Kiro Power

Installs the `hocus` MCP server and the `build-hocus-app` skill so Kiro can build point-and-speak apps and check
its own work against the real fusion engine.

**Install (Kiro IDE):** Powers panel → **Add Custom Power** → **Import power from a folder** → select this `power/`
folder.

**Requirement:** open a workspace that contains the Hocus repository. The MCP server runs
`npx tsx tools/hocus-mcp/src/index.ts` relative to the workspace root.

| Tool | What it does |
|---|---|
| `list_apps` | App ids, selectables, actions, slots and examples |
| `resolve` | Parse an utterance and resolve it against a described pointer timeline |
| `replay` | Run a replay file and diff it against its expected decisions |
| `explain` | Evidence breakdown for one decision in a replay |
| `lint_lexicon` | Missing verbs/nouns and phrase collisions in en/hi/ta |

All tools are read-only.
