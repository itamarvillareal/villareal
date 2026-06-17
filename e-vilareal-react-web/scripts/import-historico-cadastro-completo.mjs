#!/usr/bin/env node
/**
 * @deprecated Use `import-real-cadastro-completo.mjs` (import-real atualiza histórico + cadastro).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const alvo = path.join(__dirname, 'import-real-cadastro-completo.mjs');

console.warn('[aviso] import-historico-cadastro-completo.mjs está obsoleto — usando import-real-cadastro-completo.mjs\n');

const r = spawnSync(process.execPath, [alvo, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});
process.exit(r.status ?? 1);
