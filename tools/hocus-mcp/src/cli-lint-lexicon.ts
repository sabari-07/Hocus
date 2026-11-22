import { APPS, lint } from './engine-tools.ts';

/** npm run lexicon:lint -> exits 1 on any error-level issue. Used by the lexicon hook and CI. */
let errors = 0;
for (const id of [undefined, ...Object.keys(APPS)]) {
  const issues = lint(id);
  for (const i of issues) {
    if (i.severity === 'error') errors++;
    console.log(`${i.severity === 'error' ? '✗' : '!'} ${id ?? 'packs'} ${i.message}`);
  }
}
console.log(errors ? `${errors} lexicon error(s)` : '✓ lexicon packs and apps lint clean (warnings above are allowed collisions to review)');
process.exit(errors ? 1 : 0);
