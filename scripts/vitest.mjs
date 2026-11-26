// Run Vitest from a working directory whose Windows drive letter is upper case.
//
// Why: when the shell's cwd is `c:\...` (lower case, which is how Kiro hooks start commands), Vitest 5 on
// Windows loads two copies of its runner state and every suite fails at the first `describe` with
// "TypeError: Cannot read properties of undefined (reading 'config')". From `C:\...` it works.
// Reproduce: node scripts/diag-drive-case.mjs
//
// Usage: node scripts/vitest.mjs <vitest args>   (npm scripts and hooks call this, never `vitest` directly)
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const upper = (p) => p.replace(/^[a-z]:/, (d) => d.toUpperCase());
const root = upper(join(dirname(fileURLToPath(import.meta.url)), '..'));
const cwd = upper(process.cwd());
const cli = join(root, 'node_modules', 'vitest', 'vitest.mjs');

const r = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], { cwd, stdio: 'inherit', env: { ...process.env, INIT_CWD: cwd } });
process.exit(r.status ?? 1);
