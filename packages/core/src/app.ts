import type { Binding, LangCode, Selectable, Vec3 } from './types.ts';

/** Slot kinds an action can declare. The resolver turns frame slot values into these. */
export type SlotKind =
  | 'object' // one selectable id
  | 'objects' // a set of ids
  | 'place' // a surface point / screen point
  | 'entityType' // a kind from `entities` ("put a pumpkin there")
  | 'factor' // a scale factor from size words (bigger = 1.25)
  | 'quantity' // 0..1 from hand aperture ("this big")
  | 'number'
  | 'color'
  | 'boolean'
  | 'name';

export interface PlaceArg {
  x: number;
  y: number;
  world?: Vec3;
  surface?: string;
}

export type SlotArg = string | string[] | PlaceArg | number | boolean;
export type ActionArgs = Record<string, SlotArg | undefined>;

export interface ActionContext {
  labelOf: (id: string) => string;
  lang: LangCode;
  selectables: Selectable[];
}

export interface ActionSpec<S> {
  /** Slot name -> kind. Declaration order is the binding order for deictic words. */
  slots: Record<string, SlotKind>;
  /** Slots that may stay empty. */
  optional?: string[];
  /** Defaults for missing literal slots, e.g. `{ factor: 1.25 }`. */
  defaults?: Record<string, SlotArg>;
  /** Capability every object slot candidate must have (type constraint). */
  requires?: string;
  /** Destructive actions ask for confirmation when they affect more than one object. */
  destructive?: boolean;
  /** Always confirm (e.g. reset / start over). */
  alwaysConfirm?: boolean;
  /** Object slots must bind to different ids (e.g. compare). */
  distinct?: boolean;
  /** If false the action does not change the document and is not pushed on the undo stack. */
  mutates?: boolean;
  reduce: (state: S, args: ActionArgs, ctx: ActionContext) => S;
  /** Optional spoken answer after execution (e.g. planet facts). */
  respond?: (state: S, args: ActionArgs, ctx: ActionContext) => string | undefined;
  /** Preview sentence ("Make Pumpkin 2 bigger"). */
  describe?: (args: ActionArgs, ctx: ActionContext) => string;
  /** Example utterances per language, used by the Spellbook and tests. */
  examples?: Partial<Record<LangCode, string[]>>;
  /** Label for the keyboard actions menu (modality parity). */
  menuLabel?: string;
}

export interface EntitySpec {
  label: string;
  caps: string[];
}

export interface AppVocabulary {
  /** action -> extra trigger phrases */
  verbs?: Record<string, string[]>;
  /** entity kind -> nouns (singular and plural forms) */
  nouns?: Record<string, string[]>;
}

export interface AppDefinition<S> {
  id: string;
  title: string;
  initialState: S;
  selectables: (state: S) => Selectable[];
  actions: Record<string, ActionSpec<S>>;
  entities?: Record<string, EntitySpec>;
  vocabulary?: Partial<Record<LangCode, AppVocabulary>>;
  /**
   * Action run when the user says only "this one" / "that" outside a question
   * (e.g. answering a quiz by pointing). Its first object slot receives the pointing word.
   */
  pointAction?: string;
}

const RESERVED = new Set(['undo', 'redo', 'name', 'yes', 'cancel']);

/** Define a Hocus app. Validates the definition and returns it frozen. */
export function defineApp<S>(def: AppDefinition<S>): AppDefinition<S> {
  for (const [name, spec] of Object.entries(def.actions)) {
    if (RESERVED.has(name)) throw new Error(`defineApp(${def.id}): action name "${name}" is reserved by the engine`);
    for (const opt of spec.optional ?? [])
      if (!(opt in spec.slots)) throw new Error(`defineApp(${def.id}): optional slot "${opt}" is not declared in ${name}`);
  }
  return Object.freeze(def);
}

/** Convert a resolver binding into a reducer argument. */
export function bindingToArg(b: Binding): SlotArg {
  switch (b.kind) {
    case 'object':
      return b.id;
    case 'objects':
      return b.ids;
    case 'place':
      return { x: b.x, y: b.y, ...(b.world ? { world: b.world } : {}), ...(b.surface ? { surface: b.surface } : {}) };
    case 'quantity':
      return b.value;
    case 'value':
      return b.value;
  }
}
