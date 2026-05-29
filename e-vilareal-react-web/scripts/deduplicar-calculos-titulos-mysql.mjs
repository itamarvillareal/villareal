#!/usr/bin/env node
/**
 * Remove títulos vazios e duplicados em `calculo_rodada.payload_json` (MySQL).
 *
 * Corrige o padrão gerado por importações antigas da planilha layout 2026:
 * blocos de 5 títulos repetidos a cada ~20 linhas (65 posições, só 5 únicos).
 *
 * Uso:
 *   node scripts/deduplicar-calculos-titulos-mysql.mjs
 *   node scripts/deduplicar-calculos-titulos-mysql.mjs --codigo-cliente=00000928
 *   node scripts/deduplicar-calculos-titulos-mysql.mjs --confirmar=DEDUPLICAR-CALCULOS-TITULOS
 *
 * Opções:
 *   --dry-run                 Só relatório (defeito sem --confirmar)
 *   --confirmar=DEDUPLICAR-CALCULOS-TITULOS   Aplica UPDATE
 *   --codigo-cliente=00000928 Filtra um cliente (8 dígitos)
 *   --limite=N                Processa no máximo N rodadas (teste)
 *
 * MySQL: `VILAREAL_MYSQL_*` (porta 3307) — ver `scripts/lib/mysql-vilareal.mjs`
 */

import './lib/load-vilareal-import-env.mjs';

import process from 'node:process';
import { compactarTitulosImport } from './lib/import-calculo-layout2026-parse.mjs';
import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';

const CONFIRMAR_TOKEN = 'DEDUPLICAR-CALCULOS-TITULOS';

function parseArgs(argv) {
  const out = {
    dryRun: true,
    confirmar: null,
    codigoCliente: null,
    limite: null,
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--confirmar=')) out.confirmar = a.slice(12);
    else if (a.startsWith('--codigo-cliente=')) out.codigoCliente = normalizarCodigo8(a.slice(17));
    else if (a.startsWith('--limite=')) {
      const n = Number(a.slice(9));
      if (Number.isFinite(n) && n >= 1) out.limite = Math.floor(n);
    }
  }
  if (out.confirmar === CONFIRMAR_TOKEN) out.dryRun = false;
  return out;
}

function normalizarCodigo8(raw) {
  if (raw == null || raw === '') return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n)) return null;
  return String(n).padStart(8, '0');
}

/**
 * @param {unknown} titulos
 * @returns {{ antes: number, depois: number, titulos: unknown[], mudou: boolean }}
 */
function deduplicarArrayTitulos(titulos) {
  if (!Array.isArray(titulos)) {
    return { antes: 0, depois: 0, titulos: [], mudou: false };
  }
  const antes = titulos.length;
  const compact = compactarTitulosImport(titulos);
  const mudou = JSON.stringify(compact) !== JSON.stringify(titulos);
  return { antes, depois: compact.length, titulos: compact, mudou };
}

/**
 * @param {Record<string, unknown>} payload
 */
function aplicarDeduplicacaoNoPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { mudou: false, payload, detalhe: null };
  }
  const out = { ...payload };
  let mudou = false;
  const detalhe = {};

  if (Array.isArray(out.titulos)) {
    const r = deduplicarArrayTitulos(out.titulos);
    detalhe.titulos = { antes: r.antes, depois: r.depois };
    if (r.mudou) {
      out.titulos = r.titulos;
      mudou = true;
    }
  }

  if (Array.isArray(out.titulosGravadosAceito)) {
    const r = deduplicarArrayTitulos(out.titulosGravadosAceito);
    detalhe.titulosGravadosAceito = { antes: r.antes, depois: r.depois };
    if (r.mudou) {
      out.titulosGravadosAceito = r.titulos;
      mudou = true;
    }
  }

  if (mudou) {
    const pg = Number(out.pagina);
    if (Number.isFinite(pg) && pg > 1) out.pagina = 1;
  }

  return { mudou, payload: out, detalhe };
}

function formatarChave(row) {
  return `${row.codigo_cliente}|${row.numero_processo}|${row.dimensao}`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const conn = await conectarMysqlVilareal();

  const where = [];
  const params = [];
  if (opts.codigoCliente) {
    where.push('codigo_cliente = ?');
    params.push(opts.codigoCliente);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limitSql = opts.limite != null ? ` LIMIT ${opts.limite}` : '';

  console.log(
    `[dedup-calculos] modo=${opts.dryRun ? 'dry-run' : 'APLICAR'} filtro_cliente=${opts.codigoCliente ?? 'todos'}`
  );

  try {
    const [rows] = await conn.query(
      `SELECT id, codigo_cliente, numero_processo, dimensao, payload_json
       FROM calculo_rodada
       ${whereSql}
       ORDER BY id${limitSql}`,
      params
    );

    let total = 0;
    let comAlteracao = 0;
    let titulosRemovidos = 0;
    const amostras = [];

    for (const row of rows) {
      total++;
      let payload;
      try {
        payload =
          typeof row.payload_json === 'string'
            ? JSON.parse(row.payload_json)
            : row.payload_json;
      } catch (e) {
        console.warn(
          `[dedup-calculos] id=${row.id} ${formatarChave(row)}: payload_json ilegível — ${String(e?.message ?? e)}`
        );
        continue;
      }

      const { mudou, payload: novo, detalhe } = aplicarDeduplicacaoNoPayload(payload);
      if (!mudou) continue;

      comAlteracao++;
      const antesT = detalhe?.titulos?.antes ?? 0;
      const depoisT = detalhe?.titulos?.depois ?? 0;
      titulosRemovidos += Math.max(0, antesT - depoisT);

      if (amostras.length < 25) {
        amostras.push({
          chave: formatarChave(row),
          id: row.id,
          titulos: detalhe?.titulos,
          titulosGravadosAceito: detalhe?.titulosGravadosAceito,
        });
      }

      if (!opts.dryRun) {
        const json = JSON.stringify(novo);
        await conn.query(`UPDATE calculo_rodada SET payload_json = CAST(? AS JSON) WHERE id = ?`, [
          json,
          row.id,
        ]);
      }
    }

    console.log(`[dedup-calculos] rodadas_lidas=${total} rodadas_alteradas=${comAlteracao}`);
    console.log(`[dedup-calculos] titulos_removidos_aprox=${titulosRemovidos}`);
    if (amostras.length) {
      console.log('[dedup-calculos] amostra de alterações:');
      for (const a of amostras) {
        const t = a.titulos ? ` titulos ${a.titulos.antes}→${a.titulos.depois}` : '';
        const tg = a.titulosGravadosAceito
          ? ` aceito ${a.titulosGravadosAceito.antes}→${a.titulosGravadosAceito.depois}`
          : '';
        console.log(`  ${a.chave} (id=${a.id})${t}${tg}`);
      }
      if (comAlteracao > amostras.length) {
        console.log(`  ... +${comAlteracao - amostras.length} rodadas`);
      }
    }

    if (opts.dryRun && comAlteracao > 0) {
      console.log(
        `\n[dedup-calculos] Para gravar: node scripts/deduplicar-calculos-titulos-mysql.mjs --confirmar=${CONFIRMAR_TOKEN}`
      );
    } else if (!opts.dryRun && comAlteracao > 0) {
      console.log('[dedup-calculos] UPDATE concluído.');
    } else {
      console.log('[dedup-calculos] Nenhuma rodada precisava de deduplicação.');
    }
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
