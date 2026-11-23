import { afterEach, describe, expect, it } from 'vitest';
import { defineApp, lintLexicon } from '@hocus/core';
import { Proposer } from '../../packages/speech/src/proposer.ts';
import data from '../../apps/planet-explorer/src/data/solar-system.json';

describe('defineApp validation (app-sdk 1)', () => {
  const base = { id: 'x', title: 'X', initialState: {}, selectables: () => [] };
  it('rejects engine-reserved action names', () => {
    expect(() => defineApp({ ...base, actions: { undo: { slots: {}, reduce: (s) => s } } })).toThrow(/reserved/);
  });
  it('rejects optional slots that are not declared', () => {
    expect(() => defineApp({ ...base, actions: { go: { slots: {}, optional: ['where'], reduce: (s) => s } } })).toThrow(/optional slot/);
  });
});

describe('lexicon lint on a deliberately broken app (lexicon-parser 10.6)', () => {
  it('reports missing verbs per language, missing nouns and real collisions', () => {
    const broken = defineApp({
      id: 'broken',
      title: 'Broken',
      initialState: {},
      selectables: () => [],
      entities: { toad: { label: 'Toad', caps: [] } },
      actions: { zap: { slots: {}, reduce: (s) => s }, poke: { slots: {}, reduce: (s) => s } },
      vocabulary: { en: { verbs: { zap: ['hit it'], poke: ['hit it'] }, nouns: { toad: ['toad'] } } },
    });
    const issues = lintLexicon(broken);
    expect(issues.some((i) => i.code === 'missing-verbs' && i.lang === 'hi' && i.message.includes('zap'))).toBe(true);
    expect(issues.some((i) => i.code === 'missing-nouns' && i.lang === 'ta')).toBe(true);
    expect(issues.some((i) => i.code === 'collision' && i.lang === 'en' && i.message.includes('hit it'))).toBe(true);
  });
});

describe('planet data matches the NASA fact sheet values it cites (planet-explorer 5.4)', () => {
  // Snapshot of https://nssdc.gsfc.nasa.gov/planetary/factsheet/ retrieved 2026-11-22.
  const NASA: Record<string, [number, number, number]> = {
    mercury: [4879, 57.9, 0], venus: [12104, 108.2, 0], earth: [12756, 149.6, 1], mars: [6792, 228.0, 2],
    jupiter: [142984, 778.5, 95], saturn: [120536, 1432.0, 274], uranus: [51118, 2867.0, 28], neptune: [49528, 4515.0, 16],
  };
  it.each(Object.entries(NASA))('%s', (id, [d, dist, moons]) => {
    const b = data.bodies.find((x) => x.id === id)!;
    expect([b.diameterKm, b.distanceMkm, b.moons]).toEqual([d, dist, moons]);
  });
  it('the source and retrieval date are recorded', () => {
    expect(data.source.urls[0]).toContain('nssdc.gsfc.nasa.gov');
    expect(data.source.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('on-device proposer only returns an allowed command (speech-input 8.4)', () => {
  const g = globalThis as { LanguageModel?: unknown };
  afterEach(() => delete g.LanguageModel);
  const fake = (answer: string, delayMs = 0) => ({
    availability: async () => 'available',
    create: async () => ({ prompt: async () => new Promise<string>((r) => setTimeout(() => r(answer), delayMs)), destroy() {} }),
  });
  it('accepts a rewrite that matches an allowed example (case and punctuation ignored)', async () => {
    g.LanguageModel = fake(JSON.stringify({ command: 'Make that bigger!' }));
    const p = new Proposer();
    p.enabled = true;
    await p.check();
    expect(await p.propose('could you embiggen that', ['make that bigger', 'rotate that'])).toBe('Make that bigger!');
  });
  it('rejects anything not in the allowed list, invalid JSON, and when disabled', async () => {
    g.LanguageModel = fake(JSON.stringify({ command: 'delete everything' }));
    const p = new Proposer();
    p.enabled = true;
    await p.check();
    expect(await p.propose('x', ['make that bigger'])).toBeNull();
    g.LanguageModel = fake('not json');
    expect(await new Proposer().propose('x', ['make that bigger'])).toBeNull();
  });
  it('reports unsupported when the browser has no Prompt API', async () => {
    expect(await new Proposer().check()).toBe('unsupported');
  });
});
