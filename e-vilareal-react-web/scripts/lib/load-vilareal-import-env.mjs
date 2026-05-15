/**
 * Carrega variáveis para scripts de importação sem export manual na shell.
 * Por chave só preenche se `process.env[key]` estiver vazio:
 * - `<cwd>/.env.import.local` (todas as chaves)
 * - `~/.vilareal-import-env` (todas)
 * - `<cwd>/.env.development` apenas chaves que começam por `VILAREAL_` (ex.: mesma pasta que o Vite)
 *
 * Formato: `KEY=valor` por linha; `#` inicia comentário.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function aplicarLinha(line, keyPrefix) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eq = trimmed.indexOf('=');
  if (eq <= 0) return;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if (keyPrefix && !key.startsWith(keyPrefix)) return;
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return;
  if (process.env[key] !== undefined && String(process.env[key]).length > 0) return;
  process.env[key] = val;
}

/** @param {{ keyPrefix?: string }} [opts] */
function carregarFicheiro(abs, opts = {}) {
  if (!abs || !fs.existsSync(abs)) return;
  let text = fs.readFileSync(abs, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const { keyPrefix } = opts;
  for (const line of text.split(/\r?\n/)) aplicarLinha(line, keyPrefix);
}

const cwd = process.cwd();
carregarFicheiro(path.join(cwd, '.env.import.local'));
carregarFicheiro(path.join(os.homedir(), '.vilareal-import-env'));
carregarFicheiro(path.join(cwd, '.env.development'), { keyPrefix: 'VILAREAL_' });
