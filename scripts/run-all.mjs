// Run every repo command in sequence from a lower-case drive cwd (the way Kiro hooks start), and summarise.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const cwd = resolve('.').replace(/^[A-Z]:/, (d) => d.toLowerCase());
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
const steps = [
  ['turn-end hook', 'npm run lint && npm run typecheck && npm run test:unit', /Tests\s+\d+[^\n]*/],
  ['npm run check', 'npm run check', /Tests\s+\d+[^\n]*/],
  ['lexicon lint', 'npm run lexicon:lint', /(✓[^\n]*|\d+ lexicon error[^\n]*)/],
  ['sabotage mutants', 'node scripts/sanity-mutants.mjs', null],
  ['build all apps', 'npm run build', null],
  ['e2e + axe', 'npx playwright test', /\d+ passed[^\n]*|\d+ failed[^\n]*/],
];
for (const [label, cmd, re] of steps) {
  const t0 = Date.now();
  const r = spawnSync(cmd, { cwd, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = strip((r.stdout ?? '') + (r.stderr ?? ''));
  let detail = '';
  if (label === 'sabotage mutants') {
    const killed = (out.match(/KILLED/g) ?? []).length;
    const survived = (out.match(/SURVIVED|SKIP/g) ?? []).length;
    detail = `${killed} killed, ${survived} survived/skipped`;
  } else if (label === 'build all apps') {
    detail = `${(out.match(/built in/g) ?? []).length} apps built`;
  } else if (re) detail = (out.match(re)?.[0] ?? '').replace(/\s+Duration.*/, '').trim();
  const fail = out.includes("reading 'config'") ? '  (vitest runner error!)' : '';
  console.log(`${r.status === 0 ? 'PASS' : 'FAIL'}  ${label.padEnd(17)} ${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}s  ${detail}${fail}`);
  if (r.status !== 0) console.log(out.split('\n').filter((l) => /FAIL|Error|✗|failed|SURVIVED/.test(l)).slice(0, 12).join('\n'));
}
