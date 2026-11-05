// Runs every check. Usage:  npm test            (starts a local server)
//                           npm run test:live   (checks the deployed site)
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const baseArg = process.argv.find((a) => a.startsWith('--base='));
let srv = null, base;
if (baseArg) base = baseArg.slice(7); else { srv = await startServer(); base = srv.url; }
console.log('Testing', base);
const run = (file) => new Promise((resolve) => { const c = spawn(process.execPath, [path.join(here, file), base], { stdio: 'inherit' }); c.on('exit', (code) => resolve(code)); });
let failed = 0;
for (const f of ['suite.mjs', 'pwa.mjs', 'soak.mjs']) { console.log(`\n=== ${f} ===`); const code = await run(f); if (code) { failed++; console.log(`>>> ${f} FAILED (exit ${code})`); } }
if (srv) srv.srv.close();
console.log(failed ? `\n${failed} test file(s) failed` : '\nAll test files passed'); process.exit(failed ? 1 : 0);
