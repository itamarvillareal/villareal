#!/usr/bin/env node
/**
 * Compara a **data** nos ficheiros locais de histórico (tipo 16, uma linha) com `processo_andamento`
 * no MySQL: mesmo código cliente (8 dígitos), mesmo `numero_interno`, mesma **posição** do andamento
 * (ROW_NUMBER() ORDER BY movimento_em ASC, id ASC).
 *
 * **Modo principal**: índice **14** → N; **16** com prioridade em `Ano/<aaaa>/<mm>/` (ano/mês da pasta
 * orientam a interpretação de **dd/mm** na linha); depois mil. Compara com MySQL.
 *
 * **Modo disco** (`--modo=disco` ou `--modo=dir`): varredura recursiva por `*.16.1.*.txt` (útil para auditoria
 * de ficheiros fora da convenção de pastas).
 *
 * Com `--relatorio=`: nas divergências (`data_diff` e outras amostras) inclui `localAposBancoDeDados` —
 * caminho do ficheiro tipo 16 **após** a raiz «Banco de Dados» (ex.: `HC/1000/0/103/00000103.16.1.01.0001.txt`).
 *
 * Por defeito só considera andamentos com `origem = IMPORT_PLANILHA`. Use `--origem=TODAS` para todas.
 *
 * Envs: MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
 *
 * Uso:
 *   node scripts/verificar-historico-txt-vs-mysql.mjs
 *   node scripts/verificar-historico-txt-vs-mysql.mjs --modo=principal --cliente-min=1 --cliente-max=20
 *   node scripts/verificar-historico-txt-vs-mysql.mjs --modo=disco --limite=500 --verbose
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import mysql from 'mysql2/promise';
import {
  DEFAULT_BASE_HISTORICO_LOCAL,
  MAX_CLIENTE_HISTORICO_LOCAL,
  carregarContagensOpcional,
  formatCod8,
  formatIndice4,
  formatProcNomeArquivo,
  lerMaxIndiceHistorico,
  lerTipo16PrincipalComMeta,
  maxProcParaCliente,
  ymdComLinhaEPastaAno,
} from './lib/historico-local-txt-paths.mjs';

const RE_ARQ_DATA = /^(\d{8})\.16\.1\.(\d+)\.(\d{4})\.txt$/i;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function normalizarModo(s) {
  const t = String(s || '').trim().toLowerCase();
  if (t === 'disco' || t === 'dir' || t === 'walk') return 'disco';
  if (t === 'principal' || t === 'indice' || t === '14') return 'principal';
  return null;
}

function parseArgs(argv) {
  const out = {
    base: DEFAULT_BASE_HISTORICO_LOCAL,
    relatorio: null,
    limite: 0,
    verbose: false,
    origem: 'IMPORT_PLANILHA',
    modo: 'principal',
    clienteMin: 1,
    clienteMax: MAX_CLIENTE_HISTORICO_LOCAL,
    contagensPath: null,
  };
  for (const a of argv) {
    if (a === '--verbose' || a === '-v') out.verbose = true;
    else if (a.startsWith('--base=')) out.base = path.resolve(a.slice(7));
    else if (a.startsWith('--relatorio=')) out.relatorio = path.resolve(a.slice(12));
    else if (a.startsWith('--limite=')) out.limite = Math.max(0, Number(a.slice(9)) || 0);
    else if (a.startsWith('--origem=')) out.origem = a.slice(9).trim();
    else if (a.startsWith('--modo=')) {
      const m = normalizarModo(a.slice(7));
      if (m) out.modo = m;
      else console.warn('[args] --modo= inválido — uso principal');
    } else if (a.startsWith('--cliente-min=')) out.clienteMin = Math.max(1, Number(a.slice(14)) || 1);
    else if (a.startsWith('--cliente-max='))
      out.clienteMax = Math.min(
        MAX_CLIENTE_HISTORICO_LOCAL,
        Number(a.slice('--cliente-max='.length)) || MAX_CLIENTE_HISTORICO_LOCAL
      );
    else if (a.startsWith('--contagens=')) out.contagensPath = path.resolve(a.slice(12));
  }
  if (out.clienteMin > out.clienteMax) {
    const t = out.clienteMin;
    out.clienteMin = out.clienteMax;
    out.clienteMax = t;
  }
  return out;
}

/**
 * @param {string} dir
 * @returns {{ abs: string, rel: string, cod8: string, procStr: string, idx: number, nome: string }[]}
 */
function listarArquivosTipo16(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  function walk(d) {
    let ents;
    try {
      ents = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) {
        const m = e.name.match(RE_ARQ_DATA);
        if (m) {
          out.push({
            abs: p,
            rel: path.relative(dir, p),
            cod8: m[1],
            procStr: m[2],
            idx: Number.parseInt(m[3], 10),
            nome: e.name,
          });
        }
      }
    }
  }
  walk(dir);
  return out;
}

function readOneLine(p) {
  try {
    const buf = fs.readFileSync(p);
    let s = buf.toString('utf8').replace(/^\uFEFF/, '');
    const line = s.split(/\r?\n/).find((l) => String(l).trim() !== '');
    return line != null ? String(line).trim() : null;
  } catch {
    return null;
  }
}

function parseBrData(s) {
  if (s == null || String(s).trim() === '') return null;
  const t = String(s).trim();
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mo = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!Number.isFinite(dd) || !Number.isFinite(mo) || !Number.isFinite(yyyy)) return null;
  if (mo < 1 || mo > 12 || dd < 1 || dd > 31) return null;
  return `${yyyy}-${pad2(mo)}-${pad2(dd)}`;
}

function yyyyMmDoCaminhoAbs(abs) {
  const m = String(abs).match(/[/\\]Ano[/\\](\d{4})[/\\](\d{2})[/\\]/i);
  if (!m) return { yyyyPasta: null, mmPasta: null };
  return { yyyyPasta: Number.parseInt(m[1], 10), mmPasta: Number.parseInt(m[2], 10) };
}

/** dd/mm/aaaa | yyyy-mm-dd | serial Excel (número) */
function parseDataFicheiroFlexivel(linha) {
  if (linha == null) return { ymd: null, kind: 'vazio' };
  const t = String(linha).trim();
  if (!t) return { ymd: null, kind: 'vazio' };

  const br = parseBrData(t);
  if (br) return { ymd: br, kind: 'dd/mm/yyyy' };

  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { ymd: `${iso[1]}-${iso[2]}-${iso[3]}`, kind: 'iso' };

  const n = Number(t.replace(',', '.'));
  if (Number.isFinite(n)) {
    const whole = Math.floor(n);
    if (whole > 20000 && whole < 600000) {
      const utcMs = (whole - 25569) * 86400 * 1000;
      const d = new Date(utcMs);
      if (!Number.isNaN(d.getTime())) {
        return {
          ymd: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`,
          kind: 'excel_serial',
        };
      }
    }
  }
  return { ymd: null, kind: 'invalido' };
}

/** @param {Date|string} mov */
function movimentoEmParaYmdUtc(mov) {
  const d = mov instanceof Date ? mov : new Date(mov);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/**
 * @param {import('mysql2/promise').Connection} conn
 * @param {ReturnType<typeof parseArgs>} opts
 * @param {Map<string, { processoId: number, rows: { movimento_em: Date; rn: number }[] } | null>} cacheProc
 */
async function carregarAndamentosOrdenados(conn, opts, cacheProc, cod8, procInt) {
  const key = `${cod8}|${procInt}|${opts.origem}`;
  if (cacheProc.has(key)) return cacheProc.get(key);

  let sql = `
      SELECT pr.id AS processo_id
      FROM processo pr
      INNER JOIN cliente c ON c.pessoa_id = pr.pessoa_id AND c.codigo_cliente = ?
      WHERE pr.numero_interno = ?
      LIMIT 1
    `;
  const [prRows] = await conn.execute(sql, [cod8, procInt]);
  const pr = prRows?.[0];
  if (!pr?.processo_id) {
    cacheProc.set(key, null);
    return null;
  }
  const pid = Number(pr.processo_id);

  const origemClause =
    opts.origem && opts.origem.toUpperCase() !== 'TODAS' ? 'AND pa.origem = ?' : '';
  const params = opts.origem && opts.origem.toUpperCase() !== 'TODAS' ? [pid, opts.origem] : [pid];

  sql = `
      SELECT movimento_em, id,
        ROW_NUMBER() OVER (ORDER BY movimento_em ASC, id ASC) AS rn
      FROM processo_andamento pa
      WHERE pa.processo_id = ?
      ${origemClause}
    `;
  const [aRows] = await conn.execute(sql, params);
  const rows = (aRows || []).map((r) => ({
    movimento_em: r.movimento_em instanceof Date ? r.movimento_em : new Date(r.movimento_em),
    rn: Number(r.rn),
  }));
  const pack = { processoId: pid, rows };
  cacheProc.set(key, pack);
  return pack;
}

/**
 * @param {object} ctx
 * @param {import('mysql2/promise').Connection} ctx.conn
 * @param {ReturnType<typeof parseArgs>} ctx.opts
 * @param {Map<string, any>} ctx.cacheProc
 * @param {object} ctx.stats
 * @param {object[]} ctx.detalhes
 * @param {string} ctx.cod8
 * @param {number} ctx.procInt
 * @param {number} ctx.idx
 * @param {string | null} ctx.linha
 * @param {number | null} [ctx.yyyyPasta]
 * @param {number | null} [ctx.mmPasta] — de `Ano/aaaa/mm` no caminho ou da leitura principal
 */
async function compararUmaLinhaTipo16(ctx) {
  const { conn, opts, cacheProc, stats, detalhes, cod8, procInt, idx, linha, meta, yyyyPasta, mmPasta } = ctx;

  if (linha == null || String(linha).trim() === '') {
    stats.ficheirosVazios += 1;
    return;
  }

  let ymdF = ymdComLinhaEPastaAno(linha, yyyyPasta ?? null, mmPasta ?? null);
  if (!ymdF) {
    const p = parseDataFicheiroFlexivel(linha);
    if (!p.ymd) {
      stats.dataFicheiroInvalida += 1;
      detalhes.push({ ...meta, motivo: 'data_txt_invalida', conteudo: linha?.slice(0, 80) });
      return;
    }
    ymdF = p.ymd;
  }
  stats.comDataParseavel += 1;

  let pack;
  try {
    pack = await carregarAndamentosOrdenados(conn, opts, cacheProc, cod8, procInt);
  } catch (e) {
    stats.errosSql += 1;
    detalhes.push({ ...meta, motivo: 'sql', erro: String(e?.message || e) });
    return;
  }

  if (!pack) {
    stats.semProcessoNaBase += 1;
    detalhes.push({ ...meta, motivo: 'sem_processo', ymdFicheiro: ymdF });
    return;
  }

  const hit = pack.rows.find((r) => r.rn === idx);
  if (!hit) {
    stats.semAndamentoNaPosicao += 1;
    detalhes.push({
      ...meta,
      motivo: 'sem_andamento_posicao',
      ymdFicheiro: ymdF,
      processoId: pack.processoId,
      totalAndamentos: pack.rows.length,
    });
    return;
  }

  const ymdB = movimentoEmParaYmdUtc(hit.movimento_em);
  if (ymdB === ymdF) {
    stats.dataIgual += 1;
    if (opts.verbose) console.log(`OK ${cod8} proc=${procInt} idx=${idx} ${ymdF}`);
  } else {
    stats.dataDiferente += 1;
    detalhes.push({
      ...meta,
      motivo: 'data_diff',
      ymdFicheiro: ymdF,
      ymdBase: ymdB,
      processoId: pack.processoId,
      movimento_em_raw: hit.movimento_em?.toISOString?.() ?? String(hit.movimento_em),
    });
    if (opts.verbose) {
      console.warn(
        `DIFF ${meta?.rel || `${cod8}.${idx}`}: ficheiro=${ymdF} base=${ymdB} (proc ${procInt} #${idx})`
      );
    }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'root',
    database: process.env.MYSQL_DATABASE || 'vilareal',
    dateStrings: false,
  });

  const cacheProc = new Map();
  /** @type {object[]} */
  const detalhes = [];

  const statsBase = {
    ficheirosVazios: 0,
    comDataParseavel: 0,
    dataIgual: 0,
    dataDiferente: 0,
    dataFicheiroInvalida: 0,
    semProcessoNaBase: 0,
    semAndamentoNaPosicao: 0,
    errosSql: 0,
  };

  let nComparacoes = 0;
  let stats = { ...statsBase };
  let ficheirosTipo16Listados = 0;
  let clientesVisitados = 0;
  let procsComIndice = 0;
  let procsSemFicheiroIndice = 0;
  let celulasTipo16Lidas = 0;

  if (opts.modo === 'disco') {
    const arquivos = listarArquivosTipo16(opts.base);
    for (const a of arquivos) {
      try {
        a._bytes = fs.statSync(a.abs).size;
      } catch {
        a._bytes = 0;
      }
    }
    arquivos.sort((a, b) => {
      if (b._bytes !== a._bytes) return b._bytes - a._bytes;
      return `${a.cod8}|${a.procStr}|${a.idx}`.localeCompare(`${b.cod8}|${b.procStr}|${b.idx}`);
    });
    ficheirosTipo16Listados = arquivos.length;

    for (const arq of arquivos) {
      if (opts.limite > 0 && nComparacoes >= opts.limite) break;
      nComparacoes += 1;

      const procInt = Number.parseInt(arq.procStr, 10);
      if (!Number.isFinite(procInt) || procInt < 1) {
        stats.dataFicheiroInvalida += 1;
        detalhes.push({ ...arq, motivo: 'proc_invalido' });
        continue;
      }

      const linha = readOneLine(arq.abs);
      const { yyyyPasta, mmPasta } = yyyyMmDoCaminhoAbs(arq.abs);
      await compararUmaLinhaTipo16({
        conn,
        opts,
        cacheProc,
        stats,
        detalhes,
        cod8: arq.cod8,
        procInt,
        idx: arq.idx,
        linha,
        yyyyPasta,
        mmPasta,
        meta: { modo: 'disco', rel: arq.rel, abs: arq.abs, nome: arq.nome, cod8: arq.cod8, procStr: arq.procStr, idx: arq.idx, localAposBancoDeDados: arq.rel },
      });
    }
  } else {
    const contagens = carregarContagensOpcional(opts.contagensPath);
    outer: for (let cod = opts.clienteMin; cod <= opts.clienteMax; cod += 1) {
      const cod8 = formatCod8(cod);
      const maxProc = maxProcParaCliente(cod, contagens);
      clientesVisitados += 1;

      for (let proc = 1; proc <= maxProc; proc += 1) {
        const procStr = formatProcNomeArquivo(proc);
        if (!procStr) continue;

        const maxIdx = lerMaxIndiceHistorico(opts.base, cod8, cod, procStr);
        if (maxIdx == null) {
          procsSemFicheiroIndice += 1;
          continue;
        }
        procsComIndice += 1;

        for (let i = 1; i <= maxIdx; i += 1) {
          if (opts.limite > 0 && nComparacoes >= opts.limite) break outer;
          nComparacoes += 1;
          celulasTipo16Lidas += 1;

          const idx4 = formatIndice4(i);
          const meta16 = lerTipo16PrincipalComMeta(opts.base, cod8, cod, procStr, idx4);

          const procInt = proc;
          await compararUmaLinhaTipo16({
            conn,
            opts,
            cacheProc,
            stats,
            detalhes,
            cod8,
            procInt,
            idx: i,
            linha: meta16.texto,
            yyyyPasta: meta16.yyyyPasta,
            mmPasta: meta16.mmPasta,
            meta: {
              modo: 'principal',
              cod8,
              procStr,
              idx: i,
              indice4: idx4,
              localAposBancoDeDados: meta16.localAposBancoDeDados ?? null,
            },
          });
        }
      }
    }
  }

  await conn.end();

  const rel = {
    geradoEm: new Date().toISOString(),
    modo: opts.modo,
    base: opts.base,
    mysql: {
      host: process.env.MYSQL_HOST || '127.0.0.1',
      database: process.env.MYSQL_DATABASE || 'vilareal',
    },
    filtroOrigem: opts.origem,
    stats,
    ...(opts.modo === 'principal'
      ? {
          principal: {
            clientesVisitados,
            clienteMin: opts.clienteMin,
            clienteMax: opts.clienteMax,
            procsComIndice,
            procsSemFicheiroIndice,
            celulasTipo16Lidas,
            comparacoesExecutadas: nComparacoes,
          },
        }
      : {
          disco: {
            ficheirosTipo16Encontrados: ficheirosTipo16Listados,
            comparacoesExecutadas: nComparacoes,
          },
        }),
    amostrasDivergencia: detalhes.filter((d) => d.motivo === 'data_diff').slice(0, 200),
    amostrasOutros: detalhes.filter((d) => d.motivo !== 'data_diff').slice(0, 100),
  };

  console.log('\n=== Verificação histórico TXT (tipo 16) vs MySQL ===\n');
  console.log(`Modo: ${opts.modo === 'principal' ? 'principal (índice 14 → N, leitura 16)' : 'disco (walk recursivo)'}`);
  console.log(JSON.stringify(stats, null, 2));
  if (opts.modo === 'principal') {
    console.log(
      `\nPrincipal: clientes ${opts.clienteMin}–${opts.clienteMax} | procs c/ índice 14=${procsComIndice} | s/ índice=${procsSemFicheiroIndice} | leituras tipo 16=${celulasTipo16Lidas}`
    );
  } else {
    console.log(
      `\nDisco: ficheiros .16. encontrados=${ficheirosTipo16Listados} | Vazios: ${stats.ficheirosVazios} | Com data legível: ${stats.comDataParseavel}`
    );
  }
  console.log(
    'Nota: a «posição» do andamento na base é ROW_NUMBER() por processo em ORDER BY movimento_em ASC, id ASC (1 = primeiro).'
  );
  console.log(`Filtro origem: ${opts.origem.toUpperCase() === 'TODAS' ? 'todas' : opts.origem}`);

  if (opts.relatorio) {
    fs.writeFileSync(opts.relatorio, JSON.stringify(rel, null, 2), 'utf8');
    console.log(`\nRelatório JSON: ${opts.relatorio}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
