import { defineApp, type PlaceArg, type Selectable } from '@hocus/core';

/** Haunted Room Designer: the whole behaviour of App 1. Visuals live in scene.ts. */
export type ItemType =
  | 'pumpkin' | 'ghost' | 'bat' | 'candle' | 'cobweb' | 'coffin' | 'lantern'
  | 'tree' | 'skeleton' | 'cat' | 'cauldron' | 'gravestone' | 'spider' | 'window';

export interface Item {
  id: string;
  type: ItemType;
  n: number;
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
  tint: string | null;
}

export interface Room {
  items: Item[];
  lightsOn: boolean;
  counter: Partial<Record<ItemType, number>>;
}

type Mount = 'floor' | 'wall' | 'air';
export const CATALOG: Record<ItemType, { label: string; mount: Mount; size: number; colorable: boolean; y?: number }> = {
  pumpkin: { label: 'Pumpkin', mount: 'floor', size: 0.9, colorable: true },
  ghost: { label: 'Ghost', mount: 'air', size: 1.1, colorable: true, y: 1.6 },
  bat: { label: 'Bat', mount: 'air', size: 0.6, colorable: true, y: 2.6 },
  candle: { label: 'Candle', mount: 'floor', size: 0.6, colorable: true },
  cobweb: { label: 'Cobweb', mount: 'wall', size: 1.2, colorable: false, y: 3.2 },
  coffin: { label: 'Coffin', mount: 'floor', size: 1.6, colorable: true },
  lantern: { label: 'Lantern', mount: 'air', size: 0.7, colorable: true, y: 2.9 },
  tree: { label: 'Dead tree', mount: 'floor', size: 2.4, colorable: false },
  skeleton: { label: 'Skeleton', mount: 'floor', size: 1.8, colorable: false },
  cat: { label: 'Black cat', mount: 'floor', size: 0.8, colorable: true },
  cauldron: { label: 'Cauldron', mount: 'floor', size: 1.0, colorable: true },
  gravestone: { label: 'Gravestone', mount: 'floor', size: 1.2, colorable: true },
  spider: { label: 'Spider', mount: 'wall', size: 0.5, colorable: true, y: 2.4 },
  window: { label: 'Moon window', mount: 'wall', size: 1.8, colorable: false, y: 2.6 },
};
export const TYPES = Object.keys(CATALOG) as ItemType[];
const WALL_Z = -3.9;
const FLOOR = { x: [-5.4, 5.4], z: [-3.4, 3.2] } as const;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function make(room: Room, type: ItemType, x: number, z: number, y?: number): Room {
  const n = (room.counter[type] ?? 0) + 1;
  const c = CATALOG[type];
  const item: Item = { id: `${type}-${n}`, type, n, x, y: y ?? c.y ?? 0, z, scale: 1, rotation: 0, tint: null };
  return { ...room, items: [...room.items, snap(item)], counter: { ...room.counter, [type]: n } };
}

/** Snap to the floor or the back wall depending on how the item mounts. */
function snap(it: Item): Item {
  const m = CATALOG[it.type].mount;
  if (m === 'wall') return { ...it, x: clamp(it.x, FLOOR.x[0], FLOOR.x[1]), z: WALL_Z, y: clamp(it.y || (CATALOG[it.type].y ?? 2.4), 0.8, 4) };
  const y = m === 'air' ? clamp(it.y || (CATALOG[it.type].y ?? 1.6), 0.8, 3.4) : 0;
  return { ...it, x: clamp(it.x, FLOOR.x[0], FLOOR.x[1]), z: clamp(it.z, FLOOR.z[0], FLOOR.z[1]), y };
}

function placeFromArg(p: PlaceArg | undefined): { x: number; y?: number; z: number } {
  const w = p?.world ?? { x: 0, y: 0, z: 0 };
  return p?.surface === 'wall' ? { x: w.x, y: w.y, z: WALL_Z } : { x: w.x, z: w.z };
}

const update = (s: Room, id: string, f: (i: Item) => Item): Room => ({ ...s, items: s.items.map((i) => (i.id === id ? f(i) : i)) });

export const STARTERS: Record<'crypt' | 'parlor' | 'graveyard', Room> = (() => {
  const empty: Room = { items: [], lightsOn: true, counter: {} };
  const build = (list: Array<[ItemType, number, number]>) => list.reduce((r, [t, x, z]) => make(r, t, x, z), empty);
  return {
    crypt: build([['pumpkin', -0.6, 0.6], ['ghost', 2.6, -0.8], ['candle', -2.6, 0.9], ['candle', 1.0, 1.5], ['coffin', -3.6, -1.6], ['window', 0.8, 0], ['cobweb', -4.6, 0], ['cat', 3.4, 1.4]]),
    parlor: build([['pumpkin', -2, 1], ['pumpkin', 0.4, 1.2], ['cauldron', 2.4, 0], ['lantern', -1, 0], ['bat', 1.5, -1], ['spider', 3.8, 0], ['skeleton', -4, -2]]),
    graveyard: build([['tree', -3.5, -2], ['gravestone', -1, -1.5], ['gravestone', 1.2, -1.8], ['ghost', 0.2, 0], ['bat', -2, -1], ['pumpkin', 3, 1.2], ['candle', -0.5, 1.6]]),
  };
})();

export const roomApp = defineApp<Room>({
  id: 'room-designer',
  title: 'Haunted Room Designer',
  initialState: STARTERS.crypt,
  entities: Object.fromEntries(TYPES.map((t) => [t, { label: CATALOG[t].label, caps: ['scalable', ...(CATALOG[t].colorable ? ['colorable'] : [])] }])),
  selectables: (s): Selectable[] =>
    s.items.map((i) => ({
      id: i.id,
      label: `${CATALOG[i.type].label} ${i.n}`,
      kind: i.type,
      caps: ['scalable', 'movable', ...(CATALOG[i.type].colorable ? ['colorable'] : [])],
      pos: { x: i.x, y: i.y, z: i.z },
      size: CATALOG[i.type].size * i.scale,
    })),
  actions: {
    place: {
      slots: { what: 'entityType', where: 'place' },
      reduce: (s, a) => {
        const p = placeFromArg(a.where as PlaceArg);
        return make(s, a.what as ItemType, p.x, p.z, p.y);
      },
      describe: (a) => `Put a ${CATALOG[a.what as ItemType]?.label.toLowerCase() ?? 'thing'} there`,
      examples: { en: ['put a pumpkin there', 'add a bat here'], hi: ['वहाँ एक कद्दू रखो'], ta: ['அங்கே ஒரு பூசணி வை'] },
    },
    move: {
      slots: { target: 'object', destination: 'place' },
      requires: 'movable',
      reduce: (s, a) => {
        const p = placeFromArg(a.destination as PlaceArg);
        return update(s, String(a.target), (i) => snap({ ...i, x: p.x, z: p.z, y: CATALOG[i.type].mount === 'floor' ? 0 : (p.y ?? i.y) }));
      },
      describe: (a, c) => `Move ${c.labelOf(String(a.target))} there`,
      examples: { en: ['put it there', 'move that there', 'put it next to this'], hi: ['उसे यहाँ ले जाओ'], ta: ['அதை இங்கே நகர்த்து'] },
      menuLabel: 'Move to centre',
    },
    scale: {
      slots: { target: 'object', factor: 'factor' },
      defaults: { factor: 1.25 },
      requires: 'scalable',
      reduce: (s, a) => update(s, String(a.target), (i) => ({ ...i, scale: clamp(i.scale * Number(a.factor), 0.25, 4) })),
      describe: (a, c) => `Make ${c.labelOf(String(a.target))} ${Number(a.factor) >= 1 ? 'bigger' : 'smaller'}`,
      examples: { en: ['make that bigger', 'make this smaller'], hi: ['इसे बड़ा करो', 'उसे छोटा करो'], ta: ['இதை பெரிதாக்கு', 'அதை சிறிதாக்கு'] },
      menuLabel: 'Bigger',
    },
    resize: {
      slots: { target: 'object', size: 'quantity' },
      requires: 'scalable',
      reduce: (s, a) => update(s, String(a.target), (i) => ({ ...i, scale: clamp(0.4 + Number(a.size) * 2.6, 0.25, 4) })),
      describe: (a, c) => `Resize ${c.labelOf(String(a.target))} to ${Math.round(Number(a.size) * 100)}%`,
      examples: { en: ['make it this big'], hi: ['इसे इतना बड़ा करो'], ta: ['இதை இவ்வளவு பெரிதாக்கு'] },
    },
    rotate: {
      slots: { target: 'object' },
      reduce: (s, a) => update(s, String(a.target), (i) => ({ ...i, rotation: (i.rotation + Math.PI / 4) % (Math.PI * 2) })),
      describe: (a, c) => `Rotate ${c.labelOf(String(a.target))}`,
      examples: { en: ['rotate that'], hi: ['इसे घुमाओ'], ta: ['இதை சுழற்று'] },
      menuLabel: 'Rotate',
    },
    recolor: {
      slots: { target: 'object', color: 'color' },
      requires: 'colorable',
      reduce: (s, a) => update(s, String(a.target), (i) => ({ ...i, tint: String(a.color) })),
      describe: (a, c) => `Turn ${c.labelOf(String(a.target))} ${String(a.color)}`,
      examples: { en: ['turn this green', 'paint that purple'], hi: ['इसे हरा करो'], ta: ['இதை பச்சையாக்கு'] },
      menuLabel: 'Turn green',
    },
    duplicate: {
      slots: { target: 'object' },
      reduce: (s, a) => {
        const src = s.items.find((i) => i.id === String(a.target));
        if (!src) return s;
        const next = make(s, src.type, src.x + 0.9, src.z + 0.3, src.y);
        const copy = next.items[next.items.length - 1]!;
        return update(next, copy.id, (i) => ({ ...i, scale: src.scale, rotation: src.rotation, tint: src.tint }));
      },
      describe: (a, c) => `Duplicate ${c.labelOf(String(a.target))}`,
      examples: { en: ['duplicate this'], hi: ['इसे कॉपी करो'], ta: ['இதை நகலெடு'] },
      menuLabel: 'Duplicate',
    },
    delete: {
      slots: { targets: 'objects' },
      destructive: true,
      reduce: (s, a) => {
        const ids = new Set(a.targets as string[]);
        return { ...s, items: s.items.filter((i) => !ids.has(i.id)) };
      },
      describe: (a, c) => `Banish ${(a.targets as string[]).map(c.labelOf).join(', ')}`,
      examples: { en: ['delete that', 'delete these', 'delete every bat'], hi: ['इसे हटाओ', 'इन्हें हटाओ'], ta: ['இதை நீக்கு', 'இவற்றை நீக்கு'] },
      menuLabel: 'Delete',
    },
    front: {
      slots: { target: 'object' },
      reduce: (s, a) => update(s, String(a.target), (i) => snap({ ...i, z: i.z + 1 })),
      describe: (a, c) => `Bring ${c.labelOf(String(a.target))} to the front`,
      examples: { en: ['bring that to the front'], hi: ['इसे आगे लाओ'], ta: ['இதை முன்னே கொண்டு வா'] },
      menuLabel: 'To front',
    },
    back: {
      slots: { target: 'object' },
      reduce: (s, a) => update(s, String(a.target), (i) => snap({ ...i, z: i.z - 1 })),
      describe: (a, c) => `Send ${c.labelOf(String(a.target))} to the back`,
      examples: { en: ['send that to the back'], hi: ['इसे पीछे भेजो'], ta: ['இதை பின்னே அனுப்பு'] },
      menuLabel: 'To back',
    },
    lights: {
      slots: { on: 'boolean' },
      reduce: (s, a) => ({ ...s, lightsOn: Boolean(a.on) }),
      describe: (a) => `Lights ${a.on ? 'on' : 'off'}`,
      examples: { en: ['lights off', 'lights on'], hi: ['बत्ती बंद करो', 'बत्ती चालू करो'], ta: ['விளக்கு அணை', 'விளக்கு ஆன்'] },
    },
    describe: {
      slots: { target: 'object' },
      mutates: false,
      reduce: (s) => s,
      respond: (_s, a, c) => `That is ${c.labelOf(String(a.target))}.`,
      menuLabel: 'What is it?',
      examples: { en: ['what is that?'], hi: ['यह क्या है'], ta: ['இது என்ன'] },
    },
    reset: {
      slots: {},
      alwaysConfirm: true,
      reduce: () => STARTERS.crypt,
      describe: () => 'Start over with the crypt',
      examples: { en: ['start over'], hi: ['फिर से शुरू करो'], ta: ['மீண்டும் தொடங்கு'] },
    },
  },
  vocabulary: {
    en: {
      verbs: { lights: ['lights', 'light', 'lamps'] },
      nouns: {
        pumpkin: ['pumpkin', 'pumpkins', 'jack o lantern'], ghost: ['ghost', 'ghosts', 'spirit'], bat: ['bat', 'bats'],
        candle: ['candle', 'candles'], cobweb: ['cobweb', 'cobwebs', 'web', 'spider web'], coffin: ['coffin', 'coffins'],
        lantern: ['lantern', 'lanterns'], tree: ['tree', 'trees', 'dead tree'], skeleton: ['skeleton', 'skeletons'],
        cat: ['cat', 'cats', 'black cat'], cauldron: ['cauldron', 'cauldrons', 'pot'], gravestone: ['gravestone', 'gravestones', 'tombstone', 'grave'],
        spider: ['spider', 'spiders'], window: ['window', 'windows', 'moon window'],
      },
    },
    hi: {
      verbs: { lights: ['बत्ती', 'लाइट', 'रोशनी'] },
      nouns: {
        pumpkin: ['कद्दू'], ghost: ['भूत'], bat: ['चमगादड़'], candle: ['मोमबत्ती'], cobweb: ['जाला', 'मकड़जाल'], coffin: ['ताबूत'],
        lantern: ['लालटेन'], tree: ['पेड़', 'सूखा पेड़'], skeleton: ['कंकाल'], cat: ['बिल्ली', 'काली बिल्ली'], cauldron: ['कड़ाहा'],
        gravestone: ['कब्र', 'समाधि'], spider: ['मकड़ी'], window: ['खिड़की'],
      },
    },
    ta: {
      verbs: { lights: ['விளக்கு', 'விளக்குகள்'] },
      nouns: {
        pumpkin: ['பூசணி', 'பூசணிக்காய்'], ghost: ['பேய்'], bat: ['வௌவால்'], candle: ['மெழுகுவர்த்தி'], cobweb: ['சிலந்தி வலை', 'வலை'],
        coffin: ['சவப்பெட்டி'], lantern: ['லாந்தர்'], tree: ['மரம்'], skeleton: ['எலும்புக்கூடு'], cat: ['பூனை'], cauldron: ['கொப்பரை'],
        gravestone: ['கல்லறை'], spider: ['சிலந்தி'], window: ['ஜன்னல்'],
      },
    },
  },
});

export default roomApp;
