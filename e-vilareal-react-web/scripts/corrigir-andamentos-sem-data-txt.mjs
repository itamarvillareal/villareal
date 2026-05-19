#!/usr/bin/env node
/**
 * Corrige andamentos importados com data errada (ex.: «hoje») quando o txt não tinha data.
 *
 * Regra:
 *   - Com data no ficheiro tipo 16 → mantém essa data.
 *   - Sem data no txt → usa data de criação do ficheiro tipo 15 (informação).
 *
 * Delega em `atualizar-historico-local-txt.mjs` (PUT por título quando a chave data+título mudou).
 *
 * Uso:
 *   node scripts/corrigir-andamentos-sem-data-txt.mjs --cliente=687 --processo=15
 *   node scripts/corrigir-andamentos-sem-data-txt.mjs --cliente=728 --processo-min=1 --processo-max=100 --aplicar
 *   node scripts/corrigir-andamentos-sem-data-txt.mjs --cliente-min=1 --cliente-max=999 --aplicar
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const atualizar = path.join(__dirname, 'atualizar-historico-local-txt.mjs');

const extra = process.argv.slice(2);
if (!extra.some((a) => a.startsWith('--cliente'))) {
  console.error(
    'Uso: node scripts/corrigir-andamentos-sem-data-txt.mjs --cliente=N [--processo=N] [--aplicar]\n' +
      '     ou --cliente-min= / --cliente-max= para vários clientes'
  );
  process.exit(1);
}

const args = ['--somente-sem-data', ...extra];
const r = spawnSync(process.execPath, [atualizar, ...args], { stdio: 'inherit' });
process.exit(r.status ?? 1);
