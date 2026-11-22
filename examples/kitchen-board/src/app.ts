import { defineApp } from '@hocus/core';

/** Recipe Board: generated from .kiro/specs/kitchen-board (one spec), to prove the skeleton is reusable. */
export interface Card {
  id: string;
  kind: 'step' | 'ingredient';
  text: string;
  qty?: number;
  unit?: string;
  minutes?: number;
}
export interface Kitchen {
  cards: Card[];
  current: string;
  done: string[];
  timers: string[];
}

const CARDS: Card[] = [
  { id: 'flour', kind: 'ingredient', text: 'Flour', qty: 250, unit: 'g' },
  { id: 'pumpkin', kind: 'ingredient', text: 'Pumpkin purée', qty: 200, unit: 'g' },
  { id: 'sugar', kind: 'ingredient', text: 'Brown sugar', qty: 100, unit: 'g' },
  { id: 'eggs', kind: 'ingredient', text: 'Eggs', qty: 2, unit: '' },
  { id: 'step-1', kind: 'step', text: 'Whisk the pumpkin, sugar and eggs.', minutes: 2 },
  { id: 'step-2', kind: 'step', text: 'Fold in the flour.', minutes: 1 },
  { id: 'step-3', kind: 'step', text: 'Bake at 180 °C.', minutes: 25 },
  { id: 'step-4', kind: 'step', text: 'Cool, then dust with sugar.', minutes: 10 },
];
const steps = CARDS.filter((c) => c.kind === 'step').map((c) => c.id);
const label = (c: Card) => (c.kind === 'step' ? `Step ${steps.indexOf(c.id) + 1}` : c.text);
const find = (s: Kitchen, id: string) => s.cards.find((c) => c.id === id)!;
const onCard = (s: Kitchen, id: string, f: (c: Card) => Card): Kitchen => ({ ...s, cards: s.cards.map((c) => (c.id === id ? f(c) : c)) });
export const show = (c: Card) => (c.kind === 'ingredient' ? `${c.text}: ${+(c.qty ?? 0).toFixed(1)} ${c.unit ?? ''}` : c.text);

export const kitchenApp = defineApp<Kitchen>({
  id: 'kitchen-board',
  title: 'Recipe Board',
  initialState: { cards: CARDS, current: 'step-1', done: [], timers: [] },
  selectables: (s) => s.cards.map((c) => ({ id: c.id, label: label(c), kind: c.kind, caps: c.kind === 'step' ? ['step'] : ['ingredient'] })),
  actions: {
    next: {
      slots: {},
      reduce: (s) => ({ ...s, current: steps[Math.min(steps.length - 1, steps.indexOf(s.current) + 1)]! }),
      respond: (s) => show(find(s, s.current)),
      examples: { en: ['next'], hi: ['अगला'], ta: ['அடுத்தது'] },
    },
    read: {
      slots: { target: 'object' },
      mutates: false,
      reduce: (s) => s,
      respond: (s, a) => show(find(s, String(a.target))),
      examples: { en: ['read that again'], hi: ['इसे फिर से पढ़ो'], ta: ['இதை மீண்டும் படி'] },
      menuLabel: 'Read',
    },
    timer: {
      slots: { target: 'object' },
      requires: 'step',
      reduce: (s, a) => ({ ...s, timers: [...new Set([...s.timers, String(a.target)])] }),
      respond: (s, a) => `Timer set for ${find(s, String(a.target)).minutes} minutes.`,
      examples: { en: ['start a timer for that'], hi: ['इसका टाइमर लगाओ'], ta: ['இதற்கு டைமர் வை'] },
      menuLabel: 'Timer',
    },
    double: {
      slots: { target: 'object', factor: 'factor' },
      defaults: { factor: 2 },
      requires: 'ingredient',
      reduce: (s, a) => onCard(s, String(a.target), (c) => ({ ...c, qty: (c.qty ?? 0) * Number(a.factor) })),
      respond: (s, a) => show(find(s, String(a.target))),
      examples: { en: ['double this', 'half that'], hi: ['इसे दुगना करो'], ta: ['இதை இரட்டிப்பாக்கு'] },
      menuLabel: 'Double',
    },
    done: {
      slots: { target: 'object' },
      reduce: (s, a) => ({ ...s, done: [...new Set([...s.done, String(a.target)])] }),
      describe: (a, c) => `Mark ${c.labelOf(String(a.target))} done`,
      examples: { en: ['mark this done'], hi: ['इसे पूरा करो'], ta: ['இதை முடிந்தது என்று குறி'] },
      menuLabel: 'Done',
    },
  },
  vocabulary: {
    en: { verbs: { next: ['next', 'next step', 'go on'], read: ['read', 'read that again', 'again', 'repeat'], timer: ['timer', 'start a timer'], double: ['@sizeUp', '@sizeDown', 'double', 'half'], done: ['done', 'mark', 'finished', 'tick'] } },
    hi: { verbs: { next: ['अगला', 'आगे'], read: ['पढ़ो', 'फिर से पढ़ो'], timer: ['टाइमर'], double: ['@sizeUp', '@sizeDown'], done: ['पूरा', 'हो गया'] } },
    ta: { verbs: { next: ['அடுத்தது', 'அடுத்த'], read: ['படி', 'மீண்டும் படி'], timer: ['டைமர்'], double: ['@sizeUp', '@sizeDown'], done: ['முடிந்தது', 'குறி'] } },
  },
});

export default kitchenApp;
