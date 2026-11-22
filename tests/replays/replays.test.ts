import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createEngine, parseReplayFile, replay, type AppDefinition, type HocusEvent } from '@hocus/core';
import { roomApp } from '../../apps/room-designer/src/app.ts';
import { planetApp } from '../../apps/planet-explorer/src/app.ts';
import { kitchenApp } from '../../examples/kitchen-board/src/app.ts';

const APPS: Record<string, AppDefinition<unknown>> = {
  'room-designer': roomApp as AppDefinition<unknown>,
  'planet-explorer': planetApp as AppDefinition<unknown>,
  'kitchen-board': kitchenApp as AppDefinition<unknown>,
};
const DIR = join(__dirname);
const files = readdirSync(DIR).filter((f) => f.endsWith('.replay.json'));

describe('replay corpus: sessions must keep resolving the same way (hocus-lab requirement 3)', () => {
  it('has replay files', () => expect(files.length).toBeGreaterThan(0));
  for (const f of files) {
    it(f, () => {
      const file = parseReplayFile(JSON.parse(readFileSync(join(DIR, f), 'utf8')));
      const app = APPS[file.app];
      expect(app, `unknown app ${file.app}`).toBeDefined();
      const engine = createEngine(app!, file.config as never);
      const { state } = replay(engine, file.events as HocusEvent[], engine.initial({ lang: file.lang, config: file.config as never }));
      const got = state.decisions.map((d) => ({
        raw: d.raw,
        outcome: d.outcome,
        ...(d.resolution.status === 'resolved' ? { bindings: d.resolution.bindings } : {}),
      }));
      expect(got).toEqual(file.expected?.decisions);
      if (file.expected?.finalApp !== undefined) expect(state.doc.app).toEqual(file.expected.finalApp);
    });
  }
});
