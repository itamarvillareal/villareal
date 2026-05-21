#!/usr/bin/env node
/**
 * Remove processos stub: fora dos txt Dropbox, sem andamento e sem partes.
 * Não apaga processos com histórico nem os que existem no Dropbox (mesmo vazios).
 *
 *   node scripts/limpar-processos-stub-dropbox.mjs --dry-run
 *   node scripts/limpar-processos-stub-dropbox.mjs --aplicar --confirmar=APAGAR-STUBS
 *   node scripts/limpar-processos-stub-dropbox.mjs --cliente=431 --aplicar --confirmar=APAGAR-STUBS
 *   node scripts/limpar-processos-stub-dropbox.mjs --incluir-sem-cliente --dry-run
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';
import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';
import { listarProcessosDropboxCliente, apagarProcessosDependentesPorIds } from './lib/processos-dropbox-cliente.mjs';
import { listarProcessosStubLimpeza } from './lib/processos-stub-dropbox.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CONFIRMAR_TOKEN = 'APAGAR-STUBS';

function parseArgs(argv) {
  const out = {
    aplicar: false,
    cliente: null,
    clienteMin: 1,
    clienteMax: 999,
    relatorio: path.join(ROOT, 'tmp/limpar-processos-stub-dropbox.json'),
    confirmar: null,
    incluirSemCliente: false,
  };
  for (const a of argv) {
    if (a === '--aplicar') out.aplicar = true;
    else if (a === '--dry-run') out.aplicar = false;
    else if (a === '--incluir-sem-cliente') out.incluirSemCliente = true;
    else if (a.startsWith('--cliente=')) out.cliente = Number(a.slice(10));
    else if (a.startsWith('--cliente-min=')) out.clienteMin = Math.max(1, Number(a.slice(14)) || 1);
    else if (a.startsWith('--cliente-max=')) out.clienteMax = Math.min(999, Number(a.slice(14)) || 999);
    else if (a.startsWith('--relatorio=')) out.relatorio = path.resolve(a.slice(12));
    else if (a.startsWith('--confirmar=')) out.confirmar = a.slice(12);
  }
  return out;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.aplicar && opts.confirmar !== CONFIRMAR_TOKEN) {
    console.error(`Para --aplicar use --confirmar=${CONFIRMAR_TOKEN}`);
    process.exit(1);
  }

  const base = resolverBaseBancoDados();
  const conn = await conectarMysqlVilareal();
  const [clientes] = await conn.query(
    `SELECT c.codigo_cliente, c.pessoa_id FROM cliente c ORDER BY c.codigo_cliente`
  );

  /** @type {object[]} */
  const detalhe = [];
  let removidos = 0;
  let clientesAfetados = 0;
  let pulados = 0;

  if (opts.incluirSemCliente) {
    const [rows] = await conn.query(
      `SELECT p.id, p.numero_interno AS ni, p.pessoa_id
       FROM processo p
       WHERE NOT EXISTS (SELECT 1 FROM cliente c WHERE c.pessoa_id = p.pessoa_id)
         AND NOT EXISTS (SELECT 1 FROM processo_andamento a WHERE a.processo_id = p.id)
         AND NOT EXISTS (SELECT 1 FROM processo_parte pp WHERE pp.processo_id = p.id)`
    );
    if (rows.length) {
      clientesAfetados += 1;
      removidos += rows.length;
      if (opts.aplicar) {
        await apagarProcessosDependentesPorIds(
          conn,
          rows.map((r) => Number(r.id))
        );
      }
      detalhe.push({
        cliente: '(sem_cadastro)',
        removidos: rows.length,
        numeros: rows.map((r) => Number(r.ni)).slice(0, 50),
        pessoaIds: [...new Set(rows.map((r) => Number(r.pessoa_id)))].slice(0, 20),
      });
    }
  }

  for (const row of clientes) {
    const cod8 = String(row.codigo_cliente ?? '').trim();
    const codNum = Number.parseInt(cod8, 10);
    const pessoaId = Number(row.pessoa_id);
    if (opts.cliente != null && codNum !== Math.trunc(opts.cliente)) continue;
    if (!Number.isFinite(codNum) || codNum < opts.clienteMin || codNum > opts.clienteMax) continue;
    if (!Number.isFinite(pessoaId) || pessoaId < 1) continue;

    const dropbox = listarProcessosDropboxCliente(base, codNum);
    const stub = await listarProcessosStubLimpeza(conn, pessoaId, dropbox, {
      codNum,
      baseBanco: base,
      exigirPastaProc: true,
    });

    if (stub.motivoSkip) {
      pulados += 1;
      continue;
    }
    if (!stub.candidatos.length) continue;

    clientesAfetados += 1;
    removidos += stub.candidatos.length;

    if (opts.aplicar) {
      const ids = stub.candidatos.map((c) => c.id);
      await apagarProcessosDependentesPorIds(conn, ids);
    }

    detalhe.push({
      cliente: codNum,
      removidos: stub.candidatos.length,
      numeros: stub.candidatos.map((c) => c.ni).slice(0, 50),
      dropbox: dropbox.length,
    });
  }

  await conn.end();

  const relatorio = {
    modo: opts.aplicar ? 'aplicar' : 'dry-run',
    faixa: opts.cliente != null ? String(opts.cliente) : `${opts.clienteMin}..${opts.clienteMax}`,
    clientesAfetados,
    processosRemovidos: removidos,
    clientesPulados: pulados,
    incluirSemCliente: opts.incluirSemCliente,
    criterio:
      'numero_interno NOT IN Dropbox AND sem processo_andamento AND sem processo_parte' +
      (opts.incluirSemCliente ? '; opcional: pessoa sem linha em cliente' : ''),
    detalhe: detalhe.slice(0, 300),
  };

  fs.mkdirSync(path.dirname(opts.relatorio), { recursive: true });
  fs.writeFileSync(opts.relatorio, `${JSON.stringify(relatorio, null, 2)}\n`, 'utf8');

  console.log(`\n=== limpar-processos-stub-dropbox (${relatorio.modo}) ===\n`);
  console.log(`Clientes afetados: ${clientesAfetados}`);
  console.log(`Processos ${opts.aplicar ? 'removidos' : 'a remover'}: ${removidos}`);
  console.log(`Clientes pulados (skip): ${pulados}`);
  console.log(`Relatório: ${opts.relatorio}\n`);

  if (!opts.aplicar) {
    console.log(`Para aplicar: --aplicar --confirmar=${CONFIRMAR_TOKEN}\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
