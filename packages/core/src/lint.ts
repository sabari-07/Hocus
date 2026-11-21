import type { AppDefinition } from './app.ts';
import { LANGS, PACKS } from './lexicon/index.ts';
import type { LexiconPack } from './lexicon/types.ts';
import type { LangCode } from './types.ts';

export interface LexiconIssue {
  severity: 'error' | 'warning';
  lang: LangCode;
  code: 'missing-verbs' | 'collision' | 'missing-nouns' | 'empty-category';
  message: string;
}

/** Collisions the action scorer can split by slot shape (see i18n-rules.md). */
const ALLOWED_PAIRS = new Set(['move|place']);

const norm = (p: string) => p.normalize('NFC').toLowerCase().trim();

/** Lint lexicon packs, optionally against an app definition (every action needs verbs in every language). */
export function lintLexicon<S>(app?: AppDefinition<S>, packs: Record<LangCode, LexiconPack> = PACKS): LexiconIssue[] {
  const issues: LexiconIssue[] = [];
  for (const lang of LANGS) {
    const pack = packs[lang];
    for (const key of ['deictics', 'anaphors'] as const)
      if (!pack[key].length && key === 'deictics')
        issues.push({ severity: 'error', lang, code: 'empty-category', message: `${lang}: no ${key}` });

    const owners = new Map<string, Set<string>>();
    const actionNames = app ? Object.keys(app.actions) : Object.keys(pack.verbs);
    for (const action of actionNames) {
      const phrases = [...(pack.verbs[action] ?? []), ...(app?.vocabulary?.[lang]?.verbs?.[action] ?? [])];
      if (app && !phrases.length)
        issues.push({ severity: 'error', lang, code: 'missing-verbs', message: `${lang}: action "${action}" has no trigger phrases` });
      for (const p of phrases) {
        if (p.startsWith('@')) continue;
        const k = norm(p);
        if (!owners.has(k)) owners.set(k, new Set());
        owners.get(k)!.add(action);
      }
    }
    for (const [phrase, set] of owners) {
      if (set.size < 2) continue;
      const pair = [...set].sort().join('|');
      if (ALLOWED_PAIRS.has(pair)) continue;
      issues.push({ severity: 'warning', lang, code: 'collision', message: `${lang}: "${phrase}" triggers ${[...set].join(', ')}` });
    }
    if (app?.entities) {
      for (const kind of Object.keys(app.entities))
        if (!(app.vocabulary?.[lang]?.nouns?.[kind] ?? []).length)
          issues.push({ severity: 'error', lang, code: 'missing-nouns', message: `${lang}: entity "${kind}" has no nouns` });
    }
  }
  return issues;
}
