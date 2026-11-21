import type { DeicticRole, LangCode, SpatialRelation } from '../types.ts';

/**
 * A lexicon pack is DATA ONLY. The parser is order-independent slot filling, so packs never encode word order.
 *
 * Verb phrase values may contain implicit triggers:
 *  - `@color`     the presence of a colour word triggers the action ("turn that green", "இதை பச்சையாக்கு")
 *  - `@sizeUp`, `@sizeDown`  size words trigger it ("make that bigger", "इसे बड़ा करो")
 *  - `@quantity`  a quantity phrase triggers it ("make it this big")
 */
export interface LexiconPack {
  lang: LangCode;
  /** Recognizer language code. */
  bcp47: string;
  /** Native name for the language switcher. */
  name: string;
  /** Use script-aware prefix matching (agglutinative languages, e.g. Tamil). */
  prefixMatch: boolean;
  /** Spatial words follow their reference (Hindi, Tamil postpositions) instead of preceding it. */
  postpositions: boolean;
  deictics: Array<{ phrase: string; role: DeicticRole; proximal: boolean; alsoAnaphor?: boolean }>;
  /** Words that turn a preceding object deictic into a quantity ("this big"). */
  quantityHeads: string[];
  anaphors: Array<{ phrase: string; plural: boolean }>;
  articles: { indefinite: string[]; definite: string[] };
  allWords: string[];
  /** Generic verbs shipped by the skeleton. Apps add their own in `defineApp({ vocabulary })`. */
  verbs: Record<string, string[]>;
  colors: Record<string, string>;
  size: { up: string[]; down: string[]; muchUp: string[]; muchDown: string[]; double: string[]; half: string[] };
  booleans: { on: string[]; off: string[] };
  numbers: Record<string, number>;
  ordinals: Record<string, number>;
  control: {
    yes: string[];
    cancel: string[];
    undo: string[];
    redo: string[];
    otherOne: string[];
    notThat: string[];
    neither: string[];
    thisOne: string[];
    whatWasThat: string[];
  };
  spatial: Record<SpatialRelation, string[]>;
  /** Phrases that start a naming command ("call this one Boris", "इसका नाम बोरिस रखो"). */
  naming: string[];
  /** Words ignored by the parser. */
  fillers: string[];
  /** Common recognizer confusions, normalized before matching. */
  homophones: Record<string, string>;
}
