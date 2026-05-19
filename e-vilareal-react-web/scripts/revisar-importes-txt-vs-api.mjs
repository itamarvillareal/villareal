#!/usr/bin/env node
/**
 * Revisa importações de histórico: compara entradas dos txt locais (índice 14 + 15/16/17)
 * com `processo_andamento` na API/MySQL (origem IMPORT_TXT_LOCAL por defeito).
 *
 * Uso:
 *   node scripts/revisar-importes-txt-vs-api.mjs --lista=tmp/consultas-realizadas-lista-18-05-2026.json
 *   node scripts/revisar-importes-txt-vs-api.mjs --lista=... --relatorio=tmp/revisao-importes.json
 *   node scripts/revisar-importes-txt-vs-api.mjs --origem=TODAS --cliente-min=1 --cliente-max=50
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';
import { coletarEntradasHistoricoLocal } from './lib/historico-local-txt-iterar.mjs';
import {
  DEFAULT_BASE_HISTORICO_LOCAL,
  formatCod8,
  lerMaxIndiceHistorico,
  formatProcNomeArquivo,
} from './lib/historico-local-txt-paths.mjs';
import { movimentoEmFromHistoricoLocal } from './lib/historico-movimento-em.mjs';
import { normalizarTextoPlanilha } from './lib/normalizar-texto-planilha.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function parseArgs(argv) {
  const out = {
    base: DEFAULT_BASE_HISTORICO_LOCAL,
    lista: null,
    relatorio: path.join(ROOT, 'tmp/revisao-importes-txt-vs-api.json'),
    origem: 'IMPORT_TXT_LOCAL',
    clienteMin: 1,
    clienteMax: 999,
    limite: 0,
    verbose: false,
  };
  for (const a of argv) {
    if (a === '--verbose' || a === '-v') out.verbose = true;
    else if (a.startsWith('--base=')) out.base = path.resolve(a.slice(7));
    else if (a.startsWith('--lista=')) out.lista = path.resolve(a.slice(8));
    else if (a.startsWith('--relatorio=')) out.relatorio = path.resolve(a.slice(12));
    else if (a.startsWith('--origem=')) out.origem = a.slice(9).trim();
    else if (a.startsWith('--cliente-min=')) out.clienteMin = Math.max(1, Number(a.slice(14)) || 1);
    else if (a.startsWith('--cliente-max='))
      out.clienteMax = Math.min(999, Number(a.slice(14)) || 999);
    else if (a.startsWith('--limite=')) out.limite = Number(a.slice(9)) || 0;
  }
  return out;
}

function carregarLista(filePath) {
  const j = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const pares = Array.isArray(j.pares) ? j.pares : [];
  return pares
    .map((p) => ({ cod: Number(p.cod), proc: Number(p.proc) }))
    .filter((p) => p.cod >= 1 && p.proc >= 1);
}

function tituloNorm(s) {
  let t = normalizarTextoPlanilha(String(s ?? '')).trim();
  if (!t) t = 'Andamento';
  if (t.length > 500) t = t.slice(0, 500);
  return t.toUpperCase().replace(/\s+/g, ' ');
}

function ymdFromIso(iso) {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function ymdFromMovimento(mov) {
  const d = mov instanceof Date ? mov : new Date(mov);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** @param {import('mysql2/promise').Connection} conn */
async function carregarAndamentosApi(conn, cod8, proc, origem) {
  const [prRows] = await conn.query(
    `SELECT p.id AS processoId FROM processo p
     INNER JOIN cliente c ON c.pessoa_id = p.pessoa_id
     WHERE c.codigo_cliente = ? AND p.numero_interno = ? LIMIT 1`,
    [cod8, proc]
  );
  const processoId = Number(prRows[0]?.processoId);
  if (!Number.isFinite(processoId) || processoId < 1) {
    return { processoId: null, rows: [] };
  }

  const origemClause =
    origem && origem.toUpperCase() !== 'TODAS' ? 'AND pa.origem = ?' : '';
  const params =
    origem && origem.toUpperCase() !== 'TODAS' ? [processoId, origem] : [processoId];

  const [rows] = await conn.query(
    `SELECT pa.id, pa.movimento_em, pa.titulo, pa.origem,
            ROW_NUMBER() OVER (ORDER BY pa.movimento_em ASC, pa.id ASC) AS pos
     FROM processo_andamento pa
     WHERE pa.processo_id = ? ${origemClause}
     ORDER BY pa.movimento_em ASC, pa.id ASC`,
    params
  );

  return {
    processoId,
    rows: (rows || []).map((r) => ({
      id: Number(r.id),
      movimento_em: r.movimento_em,
      titulo: String(r.titulo ?? ''),
      origem: String(r.origem ?? ''),
      pos: Number(r.pos),
    })),
  };
}

function revisarProcesso(opts, cod, proc, txtEntradas, apiPack) {
  const cod8 = formatCod8(cod);
  const procStr = formatProcNomeArquivo(proc);
  const maxIdxTxt = lerMaxIndiceHistorico(opts.base, cod8, cod, procStr) ?? txtEntradas.length;
  const nTxt = txtEntradas.length;
  const nApi = apiPack.rows.length;

  /** @type {object[]} */
  const divergencias = [];
  const maxPos = Math.max(nTxt, nApi, maxIdxTxt ?? 0);

  if (nTxt !== nApi) {
    divergencias.push({
      tipo: 'contagem',
      txt: nTxt,
      api: nApi,
      indice14: maxIdxTxt,
    });
  }

  for (let pos = 1; pos <= maxPos; pos += 1) {
    const txt = txtEntradas.find((e) => e.indice === pos);
    const api = apiPack.rows[pos - 1];

    if (txt && !api) {
      divergencias.push({
        tipo: 'falta_api',
        pos,
        txtData: txt.dataBruta,
        txtTitulo: tituloNorm(txt.informacao).slice(0, 120),
      });
      continue;
    }
    if (!txt && api) {
      divergencias.push({
        tipo: 'extra_api',
        pos,
        apiId: api.id,
        apiData: ymdFromMovimento(api.movimento_em),
        apiTitulo: tituloNorm(api.titulo).slice(0, 120),
      });
      continue;
    }
    if (!txt || !api) continue;

    const isoTxt = movimentoEmFromHistoricoLocal(
      txt.dataBruta,
      txt.yyyyPasta,
      txt.mmPasta,
      txt.infoArquivoAbs
    );
    const ymdTxt = ymdFromIso(isoTxt);
    const ymdApi = ymdFromMovimento(api.movimento_em);

    if (ymdTxt !== ymdApi) {
      divergencias.push({
        tipo: 'data',
        pos,
        ymdTxt,
        ymdApi,
        dataBruta: txt.dataBruta,
        apiId: api.id,
      });
    }

    const tTxt = tituloNorm(txt.informacao);
    const tApi = tituloNorm(api.titulo);
    if (tTxt !== tApi) {
      divergencias.push({
        tipo: 'titulo',
        pos,
        txtTitulo: tTxt.slice(0, 120),
        apiTitulo: tApi.slice(0, 120),
        apiId: api.id,
      });
    }
  }

  return {
    cod,
    proc,
    cod8,
    processoId: apiPack.processoId,
    indice14: maxIdxTxt,
    entradasTxt: nTxt,
    andamentosApi: nApi,
    ok: divergencias.length === 0,
    divergencias,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  /** @type {{ cod: number, proc: number }[]} */
  let pares = [];

  if (opts.lista) {
    pares = carregarLista(opts.lista);
  } else {
    for (let cod = opts.clienteMin; cod <= opts.clienteMax; cod += 1) {
      for (let proc = 1; proc <= 999; proc += 1) {
        pares.push({ cod, proc });
      }
    }
  }

  if (opts.limite > 0) pares = pares.slice(0, opts.limite);

  console.log('\n=== revisar-importes-txt-vs-api ===\n');
  console.log(`Processos a rever: ${pares.length}`);
  console.log(`Origem API: ${opts.origem}`);
  console.log(`Base txt: ${opts.base}\n`);

  const conn = await conectarMysqlVilareal();
  const resumo = {
    geradoEm: new Date().toISOString(),
    origem: opts.origem,
    total: pares.length,
    ok: 0,
    comDivergencia: 0,
    semTxt: 0,
    semProcessoApi: 0,
    porTipo: {
      contagem: 0,
      falta_api: 0,
      extra_api: 0,
      data: 0,
      titulo: 0,
    },
    processos: [],
  };

  try {
    for (let i = 0; i < pares.length; i += 1) {
      const { cod, proc } = pares[i];
      if (opts.verbose || (i + 1) % 25 === 0 || i === 0) {
        console.log(`[${i + 1}/${pares.length}] cliente ${cod} processo ${proc}`);
      }

      const txtEntradas = coletarEntradasHistoricoLocal({
        base: opts.base,
        filtroClienteCod: cod,
        filtroProcesso: proc,
      });

      if (txtEntradas.length === 0) {
        resumo.semTxt += 1;
        const apiPack = await carregarAndamentosApi(conn, formatCod8(cod), proc, opts.origem);
        if (apiPack.rows.length > 0) {
          const r = {
            cod,
            proc,
            ok: false,
            divergencias: [{ tipo: 'sem_txt_com_api', api: apiPack.rows.length }],
          };
          resumo.comDivergencia += 1;
          resumo.processos.push(r);
        }
        continue;
      }

      const apiPack = await carregarAndamentosApi(conn, formatCod8(cod), proc, opts.origem);
      if (!apiPack.processoId) {
        resumo.semProcessoApi += 1;
        resumo.comDivergencia += 1;
        resumo.processos.push({
          cod,
          proc,
          ok: false,
          divergencias: [{ tipo: 'sem_processo_api', entradasTxt: txtEntradas.length }],
        });
        continue;
      }

      const r = revisarProcesso(opts, cod, proc, txtEntradas, apiPack);
      if (r.ok) {
        resumo.ok += 1;
      } else {
        resumo.comDivergencia += 1;
        for (const d of r.divergencias) {
          if (d.tipo in resumo.porTipo) resumo.porTipo[d.tipo] += 1;
        }
        resumo.processos.push(r);
      }
    }
  } finally {
    await conn.end();
  }

  fs.mkdirSync(path.dirname(opts.relatorio), { recursive: true });
  fs.writeFileSync(opts.relatorio, JSON.stringify(resumo, null, 2));

  console.log('\n=== RESUMO ===');
  console.log(`OK (txt = API):        ${resumo.ok}`);
  console.log(`Com divergência:       ${resumo.comDivergencia}`);
  console.log(`Sem txt local:         ${resumo.semTxt}`);
  console.log(`Sem processo na API:   ${resumo.semProcessoApi}`);
  console.log('Por tipo de divergência:');
  for (const [k, v] of Object.entries(resumo.porTipo)) {
    if (v > 0) console.log(`  ${k}: ${v}`);
  }
  console.log(`\nRelatório: ${opts.relatorio}\n`);

  process.exit(resumo.comDivergencia > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
