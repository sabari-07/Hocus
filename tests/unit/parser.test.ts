import { describe, expect, it } from 'vitest';
import { createEngine, parse, type CommandFrame } from '@hocus/core';
import { makeTestApp, type SimObject } from '@hocus/testkit';

const objects: SimObject[] = [
  { id: 'a', label: 'Pumpkin', kind: 'block', caps: ['scalable', 'colorable'], rect: { x: 100, y: 100, w: 80, h: 80 } },
  { id: 'b', label: 'Ghost', kind: 'block', caps: ['scalable'], rect: { x: 400, y: 100, w: 80, h: 80 } },
];
const engine = createEngine(makeTestApp(objects));

function frameOf(text: string, lang: 'en' | 'hi' | 'ta' = 'en'): CommandFrame {
  const s = { ...engine.initial(), lang };
  const r = parse(text, engine.parseContext(s));
  if (r.type !== 'frame') throw new Error(`expected frame for "${text}", got ${r.type}`);
  return r.frame;
}

describe('parser (lexicon-parser requirements 1-3)', () => {
  it('make that bigger -> scale with deictic target and 1.25 factor', () => {
    const f = frameOf('make that bigger');
    expect(f.action).toBe('scale');
    expect(f.slots.target).toMatchObject({ type: 'deictic', word: 'that', role: 'object', order: 0 });
    expect(f.slots.factor).toEqual({ type: 'literal', value: 1.25 });
  });

  it('put it there -> move with anaphor and place', () => {
    const f = frameOf('put it there');
    expect(f.action).toBe('move');
    expect(f.slots.target).toMatchObject({ type: 'anaphor', word: 'it' });
    expect(f.slots.destination).toMatchObject({ type: 'deictic', role: 'place', word: 'there' });
  });

  it('put a block there -> place with entity type', () => {
    const f = frameOf('put a block there');
    expect(f.action).toBe('place');
    expect(f.slots.what).toEqual({ type: 'literal', value: 'block' });
  });

  it('compare this with that keeps spoken order', () => {
    const f = frameOf('compare this with that');
    expect(f.action).toBe('compare');
    expect(f.slots.a).toMatchObject({ word: 'this', order: 0 });
    expect(f.slots.b).toMatchObject({ word: 'that', order: 1 });
  });

  it('turn this green -> recolor', () => {
    const f = frameOf('turn this green');
    expect(f.action).toBe('recolor');
    expect(f.slots.color).toEqual({ type: 'literal', value: 'green' });
  });

  it('delete these -> plural deictic', () => {
    const f = frameOf('delete these');
    expect(f.action).toBe('delete');
    expect(f.slots.targets).toMatchObject({ type: 'deictic', role: 'plural' });
  });

  it('named reference by unique label', () => {
    const f = frameOf('make the ghost bigger');
    expect(f.action).toBe('scale');
    expect(f.slots.target).toEqual({ type: 'named', name: 'ghost' });
  });

  it('naming command extracts the name with original casing', () => {
    const f = frameOf('call this one Boris');
    expect(f.action).toBe('__name');
    expect(f.slots.name).toEqual({ type: 'literal', value: 'Boris' });
  });

  it('spatial relation captures its reference', () => {
    const f = frameOf('put it next to this');
    expect(f.action).toBe('move');
    expect(f.slots.destination).toMatchObject({ type: 'spatial', relation: 'nextTo' });
  });

  it('homophones are normalized ("dat" -> that)', () => {
    expect(frameOf('make dat bigger').slots.target).toMatchObject({ word: 'that' });
  });

  it('control phrases', () => {
    const ctx = engine.parseContext(engine.initial());
    expect(parse('no, the other one', ctx)).toMatchObject({ type: 'control', intent: { kind: 'otherOne' } });
    expect(parse('undo', ctx)).toMatchObject({ type: 'control', intent: { kind: 'undo' } });
    expect(parse('the first one', ctx)).toMatchObject({ type: 'control', intent: { kind: 'choose', index: 0 } });
    expect(parse('2', ctx)).toMatchObject({ type: 'control', intent: { kind: 'choose', index: 1 } });
  });

  it('unknown phrase -> no_action with a hint, never a guess', () => {
    const r = parse('florp the wibble', engine.parseContext(engine.initial()));
    expect(r.type).toBe('no_action');
  });

  it('Hindi: इसे बड़ा करो -> scale', () => {
    const f = frameOf('इसे बड़ा करो', 'hi');
    expect(f.action).toBe('scale');
    expect(f.slots.target).toMatchObject({ type: 'deictic', role: 'object', alsoAnaphor: true });
  });

  it('Hindi: उसे यहाँ ले जाओ -> move', () => {
    const f = frameOf('उसे यहाँ ले जाओ', 'hi');
    expect(f.action).toBe('move');
    expect(f.slots.destination).toMatchObject({ role: 'place' });
  });

  it('Tamil: இதை பச்சையாக்கு -> recolor green (prefix match)', () => {
    const f = frameOf('இதை பச்சையாக்கு', 'ta');
    expect(f.action).toBe('recolor');
    expect(f.slots.color).toEqual({ type: 'literal', value: 'green' });
  });

  it('Tamil: அதை இங்கே நகர்த்து -> move', () => {
    const f = frameOf('அதை இங்கே நகர்த்து', 'ta');
    expect(f.action).toBe('move');
  });
});
