import { defineApp, type Selectable } from '@hocus/core';
import data from './data/solar-system.json';

/** Point & Ask Planet Explorer: the whole behaviour of App 2. Visuals live in scene.ts. */
export type Body = (typeof data.bodies)[number];
export const BODIES: Body[] = data.bodies;
export const QUIZ = data.quiz;
export const SOURCE = data.source;
const byId = new Map(BODIES.map((b) => [b.id, b]));
export const body = (id: string) => byId.get(id)!;

export interface Sky {
  info: string | null;
  compare: [string, string] | null;
  focus: string | null;
  trueScale: boolean;
  speed: number;
  moonsOf: string | null;
  quiz: { index: number; score: number; asked: number; last: 'right' | 'wrong' | null } | null;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 });
export const ratio = (a: number, b: number) => (a >= b ? `${fmt(a / b)}×` : `${fmt(b / a)}× smaller`);

export function describeBody(id: string): string {
  const b = body(id);
  if (b.kind === 'star') return `${b.name}: ${fmt(b.diameterKm)} km across. ${b.fact}`;
  if (b.kind === 'moon') return `The ${b.name}: ${fmt(b.diameterKm)} km across, ${fmt(b.distanceMkm * 1000)} thousand km from Earth. ${b.fact}`;
  return `${b.name}: ${fmt(b.diameterKm)} km across, ${fmt(b.distanceMkm)} million km from the Sun, ${b.moons} moon${b.moons === 1 ? '' : 's'}. ${b.fact}`;
}

export function compareBodies(a: string, b: string): string {
  const x = body(a);
  const y = body(b);
  const bigger = x.diameterKm >= y.diameterKm ? x : y;
  const smaller = bigger === x ? y : x;
  return `${bigger.name} is ${fmt(bigger.diameterKm / smaller.diameterKm)} times wider than ${smaller.name}.`;
}

const answerText = (s: Sky, id: string) => {
  const q = s.quiz && QUIZ[(s.quiz.index + QUIZ.length - 1) % QUIZ.length];
  return q ? (s.quiz!.last === 'right' ? `Yes! ${body(id).name}. ` : `Not quite: that is ${body(id).name}. ${q.hint} `) : '';
};

export const INITIAL: Sky = { info: null, compare: null, focus: null, trueScale: false, speed: 1, moonsOf: null, quiz: null };

export const planetApp = defineApp<Sky>({
  id: 'planet-explorer',
  title: 'Point & Ask Planet Explorer',
  initialState: INITIAL,
  pointAction: 'answer',
  selectables: (): Selectable[] =>
    BODIES.map((b) => ({
      id: b.id,
      label: b.name,
      kind: b.kind,
      caps: [b.kind, ...(b.kind === 'planet' ? ['orbits', 'hasMoons'] : []), ...(b.kind === 'moon' ? ['orbits'] : [])],
    })),
  actions: {
    describe: {
      slots: { target: 'object' },
      mutates: false,
      reduce: (s, a) => ({ ...s, info: String(a.target), compare: null }),
      respond: (_s, a) => describeBody(String(a.target)),
      describe: (a, c) => `What is ${c.labelOf(String(a.target))}?`,
      examples: { en: ['what is that?', 'tell me more about this'], hi: ['यह क्या है'], ta: ['இது என்ன'] },
      menuLabel: 'What is it?',
    },
    distance: {
      slots: { target: 'object' },
      requires: 'orbits',
      mutates: false,
      reduce: (s, a) => ({ ...s, info: String(a.target) }),
      respond: (_s, a) => {
        const b = body(String(a.target));
        return b.kind === 'moon' ? `The Moon is ${fmt(b.distanceMkm * 1000)} thousand km from Earth.` : `${b.name} is ${fmt(b.distanceMkm)} million km from the Sun.`;
      },
      describe: (a, c) => `How far is ${c.labelOf(String(a.target))}?`,
      examples: { en: ['how far is this from the sun?'], hi: ['यह सूरज से कितनी दूर है'], ta: ['இது சூரியனிலிருந்து எவ்வளவு தூரம்'] },
      menuLabel: 'How far?',
    },
    size: {
      slots: { target: 'object' },
      mutates: false,
      reduce: (s, a) => ({ ...s, info: String(a.target) }),
      respond: (_s, a) => `${body(String(a.target)).name} is ${fmt(body(String(a.target)).diameterKm)} km across, ${ratio(body(String(a.target)).diameterKm, body('earth').diameterKm)} Earth.`,
      describe: (a, c) => `How big is ${c.labelOf(String(a.target))}?`,
      examples: { en: ['how big is that?'], hi: ['यह कितना बड़ा है'], ta: ['இது எவ்வளவு பெரியது'] },
      menuLabel: 'How big?',
    },
    compare: {
      slots: { a: 'object', b: 'object' },
      distinct: true,
      mutates: false,
      reduce: (s, a) => ({ ...s, compare: [String(a.a), String(a.b)], info: null }),
      respond: (_s, a) => compareBodies(String(a.a), String(a.b)),
      describe: (a, c) => `Compare ${c.labelOf(String(a.a))} with ${c.labelOf(String(a.b))}`,
      examples: { en: ['compare this with that', 'which is bigger, this or that?'], hi: ['इसकी उसकी तुलना करो'], ta: ['இதை அதனுடன் ஒப்பிடு'] },
      menuLabel: 'Compare',
    },
    zoom: {
      slots: { target: 'object' },
      mutates: false,
      reduce: (s, a) => ({ ...s, focus: String(a.target), info: String(a.target) }),
      describe: (a, c) => `Fly to ${c.labelOf(String(a.target))}`,
      examples: { en: ['zoom in on that'], hi: ['उसे ज़ूम करो'], ta: ['அதை அருகில் காட்டு'] },
      menuLabel: 'Zoom',
    },
    moons: {
      slots: { target: 'object' },
      requires: 'hasMoons',
      mutates: false,
      reduce: (s, a) => ({ ...s, moonsOf: String(a.target), info: String(a.target) }),
      respond: (_s, a) => {
        const b = body(String(a.target));
        return `${b.name} has ${b.moons} known moon${b.moons === 1 ? '' : 's'} (NASA, ${SOURCE.retrieved}).`;
      },
      describe: (a, c) => `Show the moons of ${c.labelOf(String(a.target))}`,
      examples: { en: ['show its moons', 'how many moons does this have?'], hi: ['इसके चाँद दिखाओ'], ta: ['இதன் நிலவுகளைக் காட்டு'] },
      menuLabel: 'Moons',
    },
    faster: {
      slots: {},
      mutates: false,
      reduce: (s) => ({ ...s, speed: Math.min(64, s.speed * 2 || 1) }),
      describe: () => 'Spin faster',
      examples: { en: ['spin faster'], hi: ['तेज़ घुमाओ'], ta: ['வேகமாகச் சுழற்று'] },
    },
    slower: {
      slots: {},
      mutates: false,
      reduce: (s) => ({ ...s, speed: s.speed / 2 < 0.1 ? 0 : s.speed / 2 }),
      describe: () => 'Spin slower',
      examples: { en: ['slow down'], hi: ['धीरे घुमाओ'], ta: ['மெதுவாக'] },
    },
    scaleMode: {
      slots: { on: 'boolean' },
      defaults: { on: true },
      mutates: false,
      reduce: (s, a) => ({ ...s, trueScale: Boolean(a.on) }),
      describe: (a) => (a.on ? 'True scale on' : 'Readable scale'),
      examples: { en: ['true scale on', 'true scale off'], hi: ['असली पैमाना चालू'], ta: ['உண்மை அளவு ஆன்'] },
    },
    quiz: {
      slots: { on: 'boolean' },
      defaults: { on: true },
      mutates: false,
      reduce: (s, a) => ({ ...s, quiz: a.on ? { index: 0, score: 0, asked: 0, last: null } : null }),
      respond: (_s, a) => (a.on ? `Quiz time. ${QUIZ[0]!.q} Point and say “that one”.` : 'Quiz over.'),
      describe: (a) => (a.on ? 'Start the quiz' : 'Stop the quiz'),
      examples: { en: ['start the quiz', 'quiz off'], hi: ['क्विज़ शुरू करो'], ta: ['வினாடி வினா தொடங்கு'] },
    },
    answer: {
      slots: { target: 'object' },
      mutates: false,
      reduce: (s, a) => {
        if (!s.quiz) return { ...s, info: String(a.target) };
        const q = QUIZ[s.quiz.index % QUIZ.length]!;
        const right = q.a === String(a.target);
        return { ...s, info: String(a.target), quiz: { index: s.quiz.index + 1, score: s.quiz.score + (right ? 1 : 0), asked: s.quiz.asked + 1, last: right ? 'right' : 'wrong' } };
      },
      respond: (s, a) => {
        if (!s.quiz) return describeBody(String(a.target));
        const next = QUIZ[s.quiz.index % QUIZ.length]!;
        return `${answerText(s, String(a.target))}Score ${s.quiz.score} of ${s.quiz.asked}. Next: ${next.q}`;
      },
      describe: (a, c) => `Answer: ${c.labelOf(String(a.target))}`,
      examples: { en: ['that one', 'the answer is this'], hi: ['यह वाला'], ta: ['இதுதான்'] },
    },
    reset: {
      slots: {},
      mutates: false,
      reduce: (s) => ({ ...INITIAL, quiz: s.quiz }),
      describe: () => 'Reset the view',
      examples: { en: ['reset'], hi: ['रीसेट करो'], ta: ['மீட்டமை'] },
    },
  },
  vocabulary: {
    en: {
      verbs: {
        distance: ['how far', 'distance', 'far from the sun'],
        size: ['how big', 'how large', 'diameter', 'size of'],
        moons: ['moons', 'show its moons', 'how many moons'],
        faster: ['faster', 'spin faster', 'speed up'],
        slower: ['slower', 'slow down', 'spin slower'],
        scaleMode: ['true scale', 'real scale', 'scale mode'],
        quiz: ['quiz', 'quiz me', 'start the quiz', 'start quiz'],
        answer: ['the answer is', 'my answer is', 'answer'],
      },
    },
    hi: {
      verbs: {
        distance: ['कितनी दूर', 'दूरी'],
        size: ['कितना बड़ा', 'आकार'],
        moons: ['चाँद', 'चंद्रमा', 'उपग्रह'],
        faster: ['तेज़', 'तेज़ी से'],
        slower: ['धीरे', 'धीमा'],
        scaleMode: ['असली पैमाना', 'पैमाना'],
        quiz: ['क्विज़', 'प्रश्नोत्तरी'],
        answer: ['जवाब', 'उत्तर'],
      },
    },
    ta: {
      verbs: {
        distance: ['எவ்வளவு தூரம்', 'தூரம்'],
        size: ['எவ்வளவு பெரியது', 'அளவு'],
        moons: ['நிலவுகள்', 'நிலவு', 'சந்திரன்'],
        faster: ['வேகமாக', 'வேகம்'],
        slower: ['மெதுவாக'],
        scaleMode: ['உண்மை அளவு'],
        quiz: ['வினாடி வினா', 'கேள்வி'],
        answer: ['பதில்', 'விடை'],
      },
    },
  },
});

export default planetApp;
