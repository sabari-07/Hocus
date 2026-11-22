#!/usr/bin/env -S npx tsx
/**
 * hocus-mcp: lets Kiro run the real Hocus engine while it builds (F-D4).
 * Tools: list_apps, resolve, replay, explain, lint_lexicon. Read-only: never writes files.
 * Run: npm run mcp   (stdio transport)
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { explain, lint, listApps, resolveUtterance, runReplay } from './engine-tools.ts';

const server = new McpServer({ name: 'hocus-mcp', version: '0.1.0' });
const json = (v: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(v, null, 1) }] });
const safe = (fn: () => unknown) => {
  try {
    return json(fn());
  } catch (e) {
    return { isError: true, content: [{ type: 'text' as const, text: String((e as Error).message) }] };
  }
};

server.registerTool(
  'list_apps',
  { description: 'List Hocus apps with their selectable ids, actions, slots and example commands.', inputSchema: {} },
  async () => json(listApps()),
);

server.registerTool(
  'resolve',
  {
    description:
      'Resolve an utterance against an app using a described pointer timeline. Returns the parsed frame and the resolution (per-word candidates and evidence). Use it to check timing logic instead of guessing.',
    inputSchema: {
      app: z.string().describe('room-designer | planet-explorer | kitchen-board'),
      utterance: z.string().max(200),
      wordTimesMs: z.array(z.number()).max(6).describe('tWord of each pointing word, in spoken order'),
      dwells: z
        .array(z.object({ id: z.string().nullable(), startMs: z.number(), endMs: z.number(), speed: z.number().min(0).max(20).optional(), conf: z.number().min(0).max(1).optional() }))
        .max(50),
      lang: z.enum(['en', 'hi', 'ta']).optional(),
      lastActed: z.array(z.string()).max(20).optional(),
      config: z.record(z.string(), z.number()).optional(),
    },
  },
  async (input) => safe(() => resolveUtterance(input)),
);

server.registerTool(
  'replay',
  {
    description: 'Run a replay file (tests/replays/*.replay.json) and report differences from its expected decisions.',
    inputSchema: { path: z.string().max(300) },
  },
  async ({ path }) =>
    safe(() => {
      const r = runReplay(path);
      return { app: r.app, origin: r.origin, events: r.events, matches: r.matches, decisions: r.decisions, diffs: r.diffs };
    }),
);

server.registerTool(
  'explain',
  {
    description: 'Explain one decision in a replay: word times, windows, every candidate and its evidence parts (time, confidence, quality, stability).',
    inputSchema: { path: z.string().max(300), seq: z.number().int().optional() },
  },
  async ({ path, seq }) => safe(() => explain(path, seq)),
);

server.registerTool(
  'lint_lexicon',
  {
    description: 'Lint the en/hi/ta lexicon packs, optionally against an app: missing verbs, missing nouns and phrase collisions.',
    inputSchema: { app: z.string().optional() },
  },
  async ({ app }) => safe(() => lint(app)),
);

await server.connect(new StdioServerTransport());
