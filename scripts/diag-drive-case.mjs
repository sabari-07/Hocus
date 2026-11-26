// Diagnostic: Vitest 5 on Windows fails when the cwd's drive letter is lower case (c:\ vs C:\).
// Runs raw `npx vitest` and the repo's `npm run test:unit` (which goes through scripts/vitest.mjs) from both.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve('.');
const upper = root.replace(/^[a-z]:/, (d) => d.toUpperCase());
const lower = root.replace(/^[A-Z]:/, (d) => d.toLowerCase());
const runs = [
  ['raw npx vitest', 'npx vitest run --project unit tests/unit/head-gesture.test.ts'],
  ['npm run test:unit', 'npm run test:unit'],
];
for (const [label, cmd] of runs)
  for (const [name, cwd] of [
    ['C:\\', upper],
    ['c:\\', lower],
  ]) {
    const r = spawnSync(cmd, { cwd, shell: true, encoding: 'utf8' });
    const out = (r.stdout ?? '') + (r.stderr ?? '');
    const tests = out.match(/Tests\s+[^\n]*/)?.[0]?.replace(/\x1b\[[0-9;]*m/g, '').replace(/\s+Duration.*/, '').trim();
    console.log(`${label.padEnd(18)} from ${name}  exit=${r.status}  configError=${out.includes("reading 'config'")}  ${tests ?? ''}`);
  }
