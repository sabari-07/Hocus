import type { LangCode } from '../types.ts';
import { en } from './en.ts';
import { hi } from './hi.ts';
import { ta } from './ta.ts';
import type { LexiconPack } from './types.ts';

export type { LexiconPack } from './types.ts';
export { en, hi, ta };

export const PACKS: Record<LangCode, LexiconPack> = { en, hi, ta };

export function getPack(lang: LangCode): LexiconPack {
  return PACKS[lang];
}

export const LANGS: LangCode[] = ['en', 'hi', 'ta'];
