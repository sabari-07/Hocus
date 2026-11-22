// Fails loudly if packages/core reads the wall clock, uses unseeded randomness or touches the DOM.
// Enforces .kiro/steering/fusion-rules.md rules 1-2. Also run by the core-determinism hook.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'packages/core/src';
const FORBIDDEN = [
  [/\bDate\.now\s*\(/, 'Date.now()'],
  [/\bperformance\.now\s*\(/, 'performance.now()'],
  [/\bnew\s+Date\s*\(/, 'new Date()'],
  [/\bMath\.random\s*\(/, 'Math.random()'],
  [/\b(window|document|navigator|localStorage|requestAnimationFrame)\b\s*[.(]/, 'browser global'],
  [/\bsetTimeout\s*\(|\bsetInterval\s*\(/, 'timers'],
];

const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(f)) files.push(p);
  }
};
walk(ROOT);

let bad = 0;
for (const f of files) {
  readFileSync(f, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
      for (const [re, name] of FORBIDDEN)
        if (re.test(code)) {
          console.error(`✗ ${f}:${i + 1} uses ${name}: ${line.trim()}`);
          bad++;
        }
    });
}
if (bad) {
  console.error(`\n${bad} determinism violation(s). Time must arrive as data; use createRng(seed) for randomness.`);
  process.exit(1);
}
console.log(`✓ determinism: ${files.length} core files clean`);
