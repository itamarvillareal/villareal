#!/usr/bin/env node
/**
 * Exclui do MySQL os processos identificados por
 * `relatorio-processos-vazios-sem-sucessor-valido.mjs`.
 *
 * Por defeito: simulação (dry-run). Para aplicar:
 *   node scripts/excluir-processos-vazios-sem-sucessor-valido.mjs --confirmar=EXCLUIR-PROCESSOS-VAZIOS
 *
 * VPS (túnel SSH na porta 3308 — ver README):
 *   ssh -N -L 3308:127.0.0.1:3306 root@161.97.175.73
 *   node scripts/excluir-processos-vazios-sem-sucessor-valido.mjs --vps
 *   node scripts/excluir-processos-vazios-sem-sucessor-valido.mjs --vps --confirmar=EXCLUIR-PROCESSOS-VAZIOS
 *
 * Opções (mesmas do relatório):
 *   --somente-cliente-sem-valido
 *   --cliente=N
 *   --criterio-valido=judicial|completo
 *   --lote=N   (default 200)
 */

import './lib/load-vilareal-import-env.mjs';

import process from 'node:process';

import { aplicarPerfilConexao, parseFlagVps } from './lib/mysql-alvo-vilareal.mjs';
import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';
import { chunk, excluirProcessosPorIds } from './lib/processo-exclusao-mysql.mjs';
import { carregarProcessosVaziosAlvo } from './lib/processos-vazios-sem-sucessor-valido.mjs';

const CONFIRMAR_TOKEN = 'EXCLUIR-PROCESSOS-VAZIOS';

function parseArgs(argv) {
  const out = {
    dryRun: true,
    confirmar: null,
    cliente: null,
    somenteClienteSemValido: false,
    criterioValido: 'judicial',
    lote: 200,
  };
  for (const a of argv) {
    if (a.startsWith('--confirmar=')) out.confirmar = a.slice(12);
    else if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--cliente=')) out.cliente = Number(a.slice(10));
    else if (a === '--somente-cliente-sem-valido') out.somenteClienteSemValido = true;
    else if (a.startsWith('--criterio-valido=')) out.criterioValido = a.slice(18);
    else if (a.startsWith('--lote=')) out.lote = Number(a.slice(7));
    else if (a === '--help' || a === '-h') out.help = true;
  }
  if (out.confirmar === CONFIRMAR_TOKEN) out.dryRun = false;
  return out;
}

const argv = process.argv.slice(2);
const opts = parseArgs(argv);
if (opts.help) {
  console.log(`Uso: node scripts/excluir-processos-vazios-sem-sucessor-valido.mjs [--vps] [--confirmar=${CONFIRMAR_TOKEN}]`);
  process.exit(0);
}

const perfil = aplicarPerfilConexao({ vps: parseFlagVps(argv) });

const conn = await conectarMysqlVilareal();
let alvo;
try {
  ({ alvo } = await carregarProcessosVaziosAlvo(conn, opts));
} finally {
  await conn.end();
}

console.log('');
console.log('══════════════════════════════════════════════════════════════════');
console.log('  EXCLUSÃO — processos vazios sem sucessor válido');
console.log('══════════════════════════════════════════════════════════════════');
console.log(`  Alvo DB: ${perfil.alvo}`);
console.log(`  Modo: ${opts.dryRun ? 'SIMULAÇÃO (nada será apagado)' : 'APLICAÇÃO — exclusão real'}`);
console.log(`  Processos a excluir: ${alvo.length}`);
console.log(`  Clientes distintos:  ${new Set(alvo.map((r) => r.codigoCliente)).size}`);
console.log('──────────────────────────────────────────────────────────────────');

if (!alvo.length) {
  console.log('\n  Nenhum processo encontrado.\n');
  process.exit(0);
}

if (opts.dryRun) {
  console.log('\n  Amostra (10 primeiros):');
  for (const r of alvo.slice(0, 10)) {
    console.log(`    ${r.codigoCliente8} proc ${r.numeroInterno} (id ${r.processoId})`);
  }
  if (alvo.length > 10) console.log(`    … e mais ${alvo.length - 10}`);
  console.log(`\n  Para aplicar: --confirmar=${CONFIRMAR_TOKEN}\n`);
  process.exit(0);
}

const connDel = await conectarMysqlVilareal();
let excluidos = 0;
const lotes = chunk(alvo, Math.max(1, opts.lote || 200));
try {
  for (let i = 0; i < lotes.length; i += 1) {
    const lote = lotes[i];
    await connDel.beginTransaction();
    try {
      const { excluidos: n } = await excluirProcessosPorIds(
        connDel,
        lote.map((r) => ({
          id: r.processoId,
          codigoCliente: r.codigoCliente,
          numeroInterno: r.numeroInterno,
        }))
      );
      excluidos += n;
      await connDel.commit();
    } catch (err) {
      await connDel.rollback();
      throw err;
    }
    if ((i + 1) % 5 === 0 || i + 1 === lotes.length) {
      console.log(`  Lote ${i + 1}/${lotes.length} — ${excluidos} excluídos até agora`);
    }
  }
} finally {
  await connDel.end();
}

console.log('──────────────────────────────────────────────────────────────────');
console.log(`  Concluído: ${excluidos} processo(s) excluído(s).`);
console.log('══════════════════════════════════════════════════════════════════\n');
