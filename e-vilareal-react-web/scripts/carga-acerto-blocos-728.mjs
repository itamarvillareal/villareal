/**
 * Wrapper legado — delega para carga-acerto-blocos-planilha.mjs --codigo=728
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const args = ['--codigo=728', ...process.argv.slice(2)];
const r = spawnSync(process.execPath, [join(dir, 'carga-acerto-blocos-planilha.mjs'), ...args], {
  stdio: 'inherit',
});
process.exit(r.status ?? 1);
