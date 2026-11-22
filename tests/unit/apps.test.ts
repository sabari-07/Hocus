import { describe, expect, it } from 'vitest';
import { LANGS, createEngine, lintLexicon, parse, type AppDefinition } from '@hocus/core';
import { roomApp } from '../../apps/room-designer/src/app.ts';
import { planetApp } from '../../apps/planet-explorer/src/app.ts';
import { kitchenApp } from '../../examples/kitchen-board/src/app.ts';

const APPS = [roomApp, planetApp, kitchenApp] as AppDefinition<unknown>[];

describe('real apps (app-sdk requirements 1-3)', () => {
  for (const app of APPS) {
    describe(app.id, () => {
      it('lexicon lint has no errors (every action has verbs in en/hi/ta, every entity has nouns)', () => {
        const errors = lintLexicon(app).filter((i) => i.severity === 'error');
        expect(errors).toEqual([]);
      });

      it('every Spellbook example parses to its own action in every language', () => {
        const engine = createEngine(app);
        const failures: string[] = [];
        for (const lang of LANGS) {
          const ctx = engine.parseContext({ ...engine.initial(), lang });
          for (const [action, spec] of Object.entries(app.actions))
            for (const ex of spec.examples?.[lang] ?? []) {
              const r = parse(ex, ctx);
              const ok = r.type === 'frame' ? r.frame.action === action : action === app.pointAction && r.type === 'control';
              if (!ok) failures.push(`${lang} "${ex}" -> ${r.type === 'frame' ? r.frame.action : r.type} (wanted ${action})`);
            }
        }
        expect(failures).toEqual([]);
      });

      it('selectables have unique ids and labels', () => {
        const s = app.selectables(app.initialState);
        expect(new Set(s.map((x) => x.id)).size).toBe(s.length);
        expect(new Set(s.map((x) => x.label)).size).toBe(s.length);
      });
    });
  }
});
