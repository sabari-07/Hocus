// Hand-picked "sabotage" mutants: each one breaks a fusion rule on purpose and names the property
// that must catch it. Files are always restored (try/finally). Complements Stryker (npm run test:mutation).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const MUTANTS = [
  { file: 'packages/core/src/config.ts', from: 'margin: 0.15,', to: 'margin: 0,', expect: 'P03' },
  { file: 'packages/core/src/evidence.ts', from: 'const e = base * s.conf * h.quality * p.stab;', to: 'const e = base * s.conf * h.quality;', expect: 'P16' },
  { file: 'packages/core/src/engine.ts', from: "const needsConfirm = !!full && (full.alwaysConfirm || (full.destructive && pending.ids.length > 1));", to: 'const needsConfirm = false;', expect: 'P12' },
  { file: 'packages/core/src/parser.ts', from: 'return { ...v, tWord: times[v.order] ?? fallback };', to: 'return { ...v, tWord: times[times.length - 1 - v.order] ?? fallback };', expect: 'P07' },
  { file: 'packages/core/src/engine.ts', from: 'return { ...s, doc: prev, past: s.past.slice(0, -1), future: [s.doc, ...s.future] };', to: 'return { ...s, doc: s.past[0] ?? prev, past: s.past.slice(0, -1), future: [s.doc, ...s.future] };', expect: 'P08' },
  { file: 'packages/core/src/resolver.ts', from: '(!useRequires || !requiresActive || !spec.requires || s.caps.includes(spec.requires)) &&', to: 'true &&', expect: 'P15' },
  { file: 'packages/core/src/resolver.ts', from: 'if (!plural && d.kind === \'bind\' && d.best.evidence >= cfg.itOverrideEvidence)', to: "if (!plural && d.kind === 'bind')", expect: 'P11' },
];

let failures = 0;
for (const m of MUTANTS) {
  const original = readFileSync(m.file, 'utf8');
  if (!original.includes(m.from)) {
    console.log(`SKIP  ${m.expect}: pattern not found in ${m.file}`);
    failures++;
    continue;
  }
  let killed = false;
  try {
    writeFileSync(m.file, original.replace(m.from, m.to));
    try {
      execSync(`npx vitest run --project properties tests/properties/${m.expect}`, { stdio: 'pipe', env: { ...process.env, FC_RUNS: '200' } });
    } catch {
      killed = true;
    }
  } finally {
    writeFileSync(m.file, original);
  }
  console.log(`${killed ? 'KILLED' : 'SURVIVED'}  ${m.expect}  ${m.file}: ${m.to}`);
  if (!killed) failures++;
}
process.exit(failures ? 1 : 0);
