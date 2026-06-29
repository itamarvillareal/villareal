#!/usr/bin/env node
/**
 * Detecta processos cujo histórico na VPS parece importado de outro cliente
 * (mesmo nº interno) — padrão do bug 885/3 ← 001/3.
 *
 * Uso:
 *   node scripts/diagnosticar-historico-contaminacao-cruzada.mjs --gravar-vps
 *   node scripts/diagnosticar-historico-contaminacao-cruzada.mjs --gravar-vps --relatorio=tmp/hist-contaminacao.json
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';
import {
  coletarEntradasHistoricoLocal,
} from './lib/historico-local-txt-iterar.mjs';
import {
  formatCod8,
  formatProcNomeArquivo,
  lerMaxIndiceHistorico,
} from './lib/historico-local-txt-paths.mjs';

const execFileAsync = promisify(execFile);

function parseArgs(argv) {
  const out = {
    gravarVps: false,
    mysqlLocal: false,
    relatorio: null,
    limiar: 0.85,
    minAndamentos: 3,
    base: resolverBaseBancoDados(),
  };
  for (const a of argv) {
    if (a === '--gravar-vps') out.gravarVps = true;
    else if (a === '--mysql-local') out.mysqlLocal = true;
    else if (a.startsWith('--relatorio=')) out.relatorio = path.resolve(a.slice(12));
    else if (a.startsWith('--limiar=')) out.limiar = Number(a.slice(9)) || 0.85;
    else if (a.startsWith('--min-andamentos=')) out.minAndamentos = Number(a.slice(17)) || 3;
    else if (a.startsWith('--base=')) out.base = path.resolve(a.slice(7));
  }
  return out;
}

function normTitulo(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

/** @param {Set<string>} a @param {Set<string>} b */
function overlapRatio(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / Math.min(a.size, b.size);
}

/** @param {string} cod8 @param {number} proc @param {string} base */
function titulosTxtClienteProc(cod8, proc, base) {
  const cod = Number.parseInt(cod8, 10);
  const ent = coletarEntradasHistoricoLocal({
    base,
    filtroClienteCod: cod,
    filtroProcesso: proc,
  });
  return new Set(ent.map((e) => normTitulo(e.informacao)).filter(Boolean));
}

async function queryMysqlVps(sql) {
  const sshKey = process.env.VILAREAL_VPS_SSH_KEY || `${process.env.HOME}/.ssh/villareal_vps`;
  const host = process.env.VILAREAL_VPS_SSH_HOST || 'root@161.97.175.73';
  const bound = sql.replace(/"/g, '\\"');
  const { stdout } = await execFileAsync(
    'ssh',
    [
      '-i',
      sshKey,
      '-o',
      'IdentitiesOnly=yes',
      '-o',
      'BatchMode=yes',
      host,
      `mysql -u root -proot -N -B -e "${bound}" vilareal`,
    ],
    { maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' }
  );
  return stdout;
}

async function carregarResumoProcessos(opts) {
  const sql = `
SELECT TRIM(c.codigo_cliente) AS cod8,
       p.numero_interno AS ni,
       p.id AS processo_id,
       COUNT(*) AS n_andamentos
FROM processo_andamento pa
JOIN processo p ON p.id = pa.processo_id
JOIN cliente c ON c.id = p.cliente_id
GROUP BY c.codigo_cliente, p.numero_interno, p.id
ORDER BY cod8, ni`;

  if (opts.mysqlLocal) {
    const { conectarMysqlVilareal } = await import('./lib/mysql-vilareal.mjs');
    const conn = await conectarMysqlVilareal();
    try {
      const [rows] = await conn.query(sql);
      return rows;
    } finally {
      await conn.end?.();
    }
  }

  const stdout = await queryMysqlVps(sql);
  return stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [cod8, ni, processo_id, n_andamentos] = line.split('\t');
      return { cod8, ni: Number(ni), processo_id: Number(processo_id), n_andamentos: Number(n_andamentos) };
    });
}

/** @param {number[]} processoIds @param {ReturnType<typeof parseArgs>} opts */
async function carregarTitulosPorProcessoIds(processoIds, opts) {
  /** @type {Map<number, Set<string>>} */
  const map = new Map();
  const chunk = 200;
  for (let i = 0; i < processoIds.length; i += chunk) {
    const slice = processoIds.slice(i, i + chunk);
    const sql = `SELECT processo_id, UPPER(TRIM(SUBSTRING(titulo,1,120))) AS t
FROM processo_andamento WHERE processo_id IN (${slice.join(',')}) ORDER BY processo_id, movimento_em, id`;

    /** @type {{ processo_id: number, t: string }[]} */
    let rows;
    if (opts.mysqlLocal) {
      const { conectarMysqlVilareal } = await import('./lib/mysql-vilareal.mjs');
      const conn = await conectarMysqlVilareal();
      try {
        const [r] = await conn.query(sql);
        rows = r;
      } finally {
        await conn.end?.();
      }
    } else {
      const stdout = await queryMysqlVps(sql);
      rows = stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [processo_id, t] = line.split('\t');
          return { processo_id: Number(processo_id), t };
        });
    }

    for (const r of rows) {
      const pid = Number(r.processo_id);
      if (!map.has(pid)) map.set(pid, new Set());
      const n = normTitulo(r.t);
      if (n) map.get(pid).add(n);
    }
  }
  return map;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.gravarVps && !opts.mysqlLocal) {
    console.error('Use --gravar-vps ou --mysql-local');
    process.exit(2);
  }

  console.log('[contaminacao] A carregar processos com andamentos na base…');
  const rows = await carregarResumoProcessos(opts);
  console.log(`[contaminacao] ${rows.length} processo(s) com andamentos`);

  /** @type {Map<number, Set<number>>} proc -> cod nums com txt HC */
  const clientesComTxtPorProc = new Map();
  /** @type {Map<string, Set<string>>} `${cod8}|${ni}` -> titulos txt */
  const cacheTxt = new Map();
  /** @type {Map<string, number | null>} key -> maxIdx */
  const cacheMaxIdx = new Map();

  function maxIdxTxt(cod8, ni) {
    const key = `${cod8}|${ni}`;
    if (cacheMaxIdx.has(key)) return cacheMaxIdx.get(key);
    const cod = Number.parseInt(cod8, 10);
    const procStr = formatProcNomeArquivo(ni);
    const maxIdx = lerMaxIndiceHistorico(opts.base, cod8, cod, procStr);
    cacheMaxIdx.set(key, maxIdx);
    return maxIdx;
  }

  function getTxtSet(cod8, ni) {
    const key = `${cod8}|${ni}`;
    if (cacheTxt.has(key)) return cacheTxt.get(key);
    const cod = Number.parseInt(cod8, 10);
    const maxIdx = maxIdxTxt(cod8, ni);
    const set = maxIdx != null && maxIdx > 0 ? titulosTxtClienteProc(cod8, ni, opts.base) : new Set();
    cacheTxt.set(key, set);
    if (set.size > 0) {
      if (!clientesComTxtPorProc.has(ni)) clientesComTxtPorProc.set(ni, new Set());
      clientesComTxtPorProc.get(ni).add(cod);
    }
    return set;
  }

  /** Pré-indexar quais clientes têm txt HC por nº interno (só índice 14/16, sem ler entradas). */
  const numerosInternos = [...new Set(rows.map((r) => Number(r.ni)))].sort((a, b) => a - b);
  console.log(`[contaminacao] A indexar presença txt HC (${numerosInternos.length} nº internos)…`);
  for (let c = 1; c <= 999; c += 1) {
    if (c % 100 === 0) console.log(`[contaminacao] index HC clientes… ${c}/999`);
    const cod8 = formatCod8(c);
    for (const ni of numerosInternos) {
      const maxIdx = maxIdxTxt(cod8, ni);
      if (maxIdx != null && maxIdx >= opts.minAndamentos) {
        if (!clientesComTxtPorProc.has(ni)) clientesComTxtPorProc.set(ni, new Set());
        clientesComTxtPorProc.get(ni).add(c);
      }
    }
  }
  console.log(`[contaminacao] Pares (cliente, proc) com HC: ${[...clientesComTxtPorProc.values()].reduce((a, s) => a + s.size, 0)}`);

  /** @type {object[]} */
  const candidatos = [];
  /** @type {object[]} */
  const semTxtComAndamentos = [];

  for (const row of rows) {
    const cod8 = String(row.cod8).padStart(8, '0');
    const ni = Number(row.ni);
    const nDb = Number(row.n_andamentos);
    if (nDb < opts.minAndamentos) continue;
    const maxIdx = maxIdxTxt(cod8, ni);
    const txtN = maxIdx ?? 0;
    if (txtN === 0) {
      semTxtComAndamentos.push({
        cod8,
        numeroInterno: ni,
        processoId: row.processo_id,
        andamentosDb: nDb,
      });
      candidatos.push(row);
      continue;
    }
    if (Math.abs(nDb - txtN) / Math.max(txtN, 1) > 0.25) {
      candidatos.push(row);
    }
  }

  console.log(
    `[contaminacao] ${semTxtComAndamentos.length} sem txt HC (≥${opts.minAndamentos} and.); ` +
      `${candidatos.length} candidato(s) a verificar títulos`
  );

  const titulosMap = await carregarTitulosPorProcessoIds(
    candidatos.map((r) => Number(r.processo_id)),
    opts
  );

  /** @type {object[]} */
  const suspeitos = [];

  for (const row of candidatos) {
    const cod8 = String(row.cod8).padStart(8, '0');
    const ni = Number(row.ni);
    const dbTitulos = titulosMap.get(Number(row.processo_id)) ?? new Set();
    if (dbTitulos.size < opts.minAndamentos) continue;

    const ownTxt = getTxtSet(cod8, ni);
    const ownOverlap = overlapRatio(dbTitulos, ownTxt);

    if (ownOverlap >= opts.limiar) continue;

    /** @type {{ cod8: string, overlap: number, txtCount: number } | null} */
    let melhorOutro = null;
    const outros = clientesComTxtPorProc.get(ni);
    if (!outros) continue;

    for (const outroCod of outros) {
      if (outroCod === Number.parseInt(cod8, 10)) continue;
      const outroCod8 = formatCod8(outroCod);
      const outroTxt = getTxtSet(outroCod8, ni);
      if (outroTxt.size < opts.minAndamentos) continue;
      const ov = overlapRatio(dbTitulos, outroTxt);
      if (ov >= opts.limiar && (!melhorOutro || ov > melhorOutro.overlap)) {
        melhorOutro = { cod8: outroCod8, overlap: ov, txtCount: outroTxt.size };
      }
    }

    if (melhorOutro && melhorOutro.overlap > ownOverlap + 0.1) {
      suspeitos.push({
        cod8,
        numeroInterno: ni,
        processoId: row.processo_id,
        andamentosDb: dbTitulos.size,
        overlapProprio: Math.round(ownOverlap * 1000) / 1000,
        txtProprio: ownTxt.size,
        provavelFonte: melhorOutro.cod8,
        overlapFonte: Math.round(melhorOutro.overlap * 1000) / 1000,
        txtFonte: melhorOutro.txtCount,
        amostraDb: [...dbTitulos].slice(0, 2),
      });
    }
  }

  suspeitos.sort((a, b) => b.overlapFonte - a.overlapFonte || a.cod8.localeCompare(b.cod8));

  const rel = {
    geradoEm: new Date().toISOString(),
    processosAnalisados: rows.length,
    limiar: opts.limiar,
    minAndamentos: opts.minAndamentos,
    suspeitosContaminacao: suspeitos,
    semTxtComAndamentos: semTxtComAndamentos.length,
    semTxtComAndamentosAmostra: semTxtComAndamentos.slice(0, 30),
  };

  console.log('\n=== Histórico — possível contaminação cruzada ===\n');
  console.log(`Processos analisados: ${rows.length}`);
  console.log(`Sem txt HC mas com andamentos (≥${opts.minAndamentos}): ${semTxtComAndamentos.length}`);
  console.log(`Suspeitos (overlap ≥${opts.limiar} com outro cliente, mesmo proc.): ${suspeitos.length}\n`);

  for (const s of suspeitos.slice(0, 50)) {
    console.log(
      `  ${s.cod8} proc ${s.numeroInterno} (id ${s.processoId}) — ${s.andamentosDb} and. | ` +
        `txt próprio ${s.txtProprio} (${Math.round(s.overlapProprio * 100)}%) → ` +
        `fonte ${s.provavelFonte} (${Math.round(s.overlapFonte * 100)}%, txt ${s.txtFonte})`
    );
  }
  if (suspeitos.length > 50) console.log(`  … +${suspeitos.length - 50} (ver relatório JSON)`);

  const outPath = opts.relatorio || path.join('tmp', 'historico-contaminacao-cruzada.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(rel, null, 2), 'utf8');
  console.log(`\nRelatório: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
