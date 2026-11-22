import { spawn } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { explain, resolveUtterance, runReplay } from '../../tools/hocus-mcp/src/engine-tools.ts';

describe('hocus-mcp tools', () => {
  it('resolve binds "compare this with that" from a dwell timeline', () => {
    const r = resolveUtterance({
      app: 'planet-explorer',
      utterance: 'compare this with that',
      wordTimesMs: [900, 1900],
      dwells: [
        { id: 'mars', startMs: 300, endMs: 1000 },
        { id: null, startMs: 1000, endMs: 1150, speed: 3 },
        { id: 'earth', startMs: 1150, endMs: 2000 },
      ],
    });
    expect(r.resolution?.status).toBe('resolved');
    if (r.resolution?.status === 'resolved') {
      expect(r.resolution.bindings.a).toEqual({ kind: 'object', id: 'mars' });
      expect(r.resolution.bindings.b).toEqual({ kind: 'object', id: 'earth' });
    }
  });

  it('replay reports a match for the committed corpus', () => {
    expect(runReplay('tests/replays/room-bigger-put-there.replay.json').matches).toBe(true);
  });

  it('explain returns evidence parts per candidate', () => {
    const e = explain('tests/replays/planets-compare.replay.json');
    expect(e.words[0]?.candidates[0]).toMatchObject({ id: 'mars' });
    expect(e.words[0]?.candidates[0]).toHaveProperty('stability');
  });

  it('the stdio server answers tools/list over MCP', async () => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'tools/hocus-mcp/src/index.ts'], { stdio: ['pipe', 'pipe', 'inherit'] });
    const send = (m: unknown) => child.stdin.write(`${JSON.stringify(m)}\n`);
    const lines: string[] = [];
    const got = new Promise<string[]>((resolve) => {
      child.stdout.on('data', (b: Buffer) => {
        lines.push(...b.toString().split('\n').filter(Boolean));
        if (lines.some((l) => l.includes('"id":2'))) resolve(lines);
      });
    });
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } } });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const out = await Promise.race([got, new Promise<string[]>((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000))]);
    child.kill();
    const list = JSON.parse(out.find((l) => l.includes('"id":2'))!);
    expect(list.result.tools.map((t: { name: string }) => t.name).sort()).toEqual(['explain', 'lint_lexicon', 'list_apps', 'replay', 'resolve']);
  }, 30000);
});
