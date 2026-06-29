#!/usr/bin/env node
/**
 * Relatório processo a processo: cabeçalho/partes/histórico nos txt (Dropbox) vs processo na VPS.
 *
 * Uso:
 *   node scripts/diagnosticar-processos-txt-vs-vps.mjs --cliente=299
 *   node scripts/diagnosticar-processos-txt-vs-vps.mjs --cliente=299 --mysql-local
 *   node scripts/diagnosticar-processos-txt-vs-vps.mjs --cliente=299 --relatorio=../tmp/proc-299-txt-vps.json --csv=../tmp/proc-299-txt-vps.csv
 */

import './lib/load-vilareal-import-env.mjs';

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';
import { lerStatusProcessoTxt } from './lib/gerais-fase-processo-txt.mjs';
import {
  formatCod8,
  formatProcNomeArquivo,
  lerMaxIndiceHistorico,
} from './lib/historico-local-txt-paths.mjs';
import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';
import { lerCabecalhoProcessoTxt } from './lib/proc-processo-cabecalho-txt.mjs';
import {
  lerPartesProcessoTxt,
  listarProcessosComPartesTxt,
} from './lib/proc-processo-partes-txt.mjs';
import { listarProcessosDropboxCliente } from './lib/processos-dropbox-cliente.mjs';

const execFileAsync = promisify(execFile);

const CAMPOS_CABECALHO = [
  ['unidade', 'unidade'],
  ['numeroCnj', 'numero_cnj'],
  ['numeroProcessoAntigo', 'numero_processo_antigo'],
  ['naturezaAcao', 'natureza_acao'],
  ['descricaoAcao', 'descricao_acao'],
  ['competencia', 'competencia'],
  ['tramitacao', 'tramitacao'],
  ['observacao', 'observacao'],
  ['uf', 'uf'],
  ['cidade', 'cidade'],
];

function parseArgs(argv) {
  const out = {
    cliente: null,
    base: resolverBaseBancoDados(),
    relatorio: null,
    csv: null,
    mysqlLocal: false,
    vpsHost: process.env.VPS_HOST || 'root@161.97.175.73',
    vpsSshKey: process.env.VPS_SSH_KEY || path.join(os.homedir(), '.ssh', 'villareal_vps'),
    dbName: process.env.VILAREAL_MYSQL_DATABASE || 'vilareal',
    dbUser: process.env.VILAREAL_MYSQL_USER || 'root',
    dbPass: process.env.VILAREAL_MYSQL_PASSWORD || 'root',
  };
  for (const a of argv) {
    if (a.startsWith('--cliente=')) out.cliente = Number(a.slice(10));
    else if (a.startsWith('--base=')) out.base = a.slice(7);
    else if (a.startsWith('--relatorio=')) out.relatorio = a.slice(12);
    else if (a.startsWith('--csv=')) out.csv = a.slice(6);
    else if (a === '--mysql-local') out.mysqlLocal = true;
  }
  return out;
}

function normStr(v) {
  const s = String(v ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  return s || null;
}

function normCnj(v) {
  const s = normStr(v);
  return s ? s.replace(/\s/g, '') : null;
}

function normValor(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v * 100) / 100;
  const s = String(v)
    .trim()
    .replace(/R\$\s*/gi, '')
    .replace(/\s/g, '');
  if (!s) return null;
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function normDate(v) {
  const s = normStr(v);
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return s;
}

/** @param {string} txtKey @param {unknown} txtVal @param {unknown} vpsVal */
function cmpCampo(txtKey, txtVal, vpsVal) {
  if (txtKey === 'numeroCnj') {
    const a = normCnj(txtVal);
    const b = normCnj(vpsVal);
    return a === b ? null : { campo: txtKey, txt: a, vps: b };
  }
  if (txtKey === 'valorCausa') {
    const a = normValor(txtVal);
    const b = normValor(vpsVal);
    return a === b ? null : { campo: txtKey, txt: a, vps: b };
  }
  if (txtKey === 'prazoFatal' || txtKey === 'proximaConsulta' || txtKey === 'dataProtocolo') {
    const a = normDate(txtVal);
    const b = normDate(vpsVal);
    return a === b ? null : { campo: txtKey, txt: a, vps: b };
  }
  const a = normStr(txtVal);
  const b = normStr(vpsVal);
  if (a === b) return null;
  if (!a && !b) return null;
  return { campo: txtKey, txt: a, vps: b };
}

const SQL_PROCESSOS = `
SELECT
  p.id AS processo_id,
  p.numero_interno,
  p.unidade,
  p.numero_cnj,
  p.numero_processo_antigo,
  p.natureza_acao,
  p.descricao_acao,
  p.fase,
  p.competencia,
  p.tramitacao,
  p.observacao,
  p.valor_causa,
  p.prazo_fatal,
  p.proxima_consulta,
  p.uf,
  p.cidade,
  p.ativo,
  (SELECT COUNT(*) FROM processo_parte pp WHERE pp.processo_id = p.id) AS partes_mysql,
  (SELECT COUNT(*) FROM processo_andamento pa WHERE pa.processo_id = p.id) AS andamentos_mysql,
  (SELECT COUNT(*) FROM calculo_rodada cr
     WHERE TRIM(cr.codigo_cliente) = ? AND cr.numero_processo = p.numero_interno) AS calculos_mysql
FROM processo p
INNER JOIN cliente c ON c.id = p.cliente_id
WHERE TRIM(c.codigo_cliente) IN (?, ?)
ORDER BY p.numero_interno
`.trim();

/** @param {ReturnType<typeof parseArgs>} opts @param {string} cod8 */
async function carregarVpsPorProc(opts, cod8) {
  /** @type {Map<number, Record<string, unknown>>} */
  const map = new Map();

  if (opts.mysqlLocal) {
    const conn = await conectarMysqlVilareal();
    try {
      const [rows] = await conn.query(SQL_PROCESSOS, [cod8, cod8, String(Number(cod8))]);
      for (const r of rows) {
        map.set(Number(r.numero_interno), r);
      }
    } finally {
      await conn.end();
    }
    return map;
  }

  const esc = (s) => `'${String(s).replace(/'/g, "''")}'`;
  const bound = SQL_PROCESSOS.replace(/\?/g, () => esc(cod8));

  const sshArgs = [];
  if (fs.existsSync(opts.vpsSshKey)) {
    sshArgs.push('-i', opts.vpsSshKey, '-o', 'IdentitiesOnly=yes');
  }
  sshArgs.push(
    opts.vpsHost,
    `mysql -u ${opts.dbUser} -p${opts.dbPass} -N -B -e "${bound.replace(/"/g, '\\"')}" ${opts.dbName}`,
  );

  const { stdout } = await execFileAsync('ssh', sshArgs, {
    maxBuffer: 64 * 1024 * 1024,
    encoding: 'utf8',
  });

  const headers = [
    'processo_id',
    'numero_interno',
    'unidade',
    'numero_cnj',
    'numero_processo_antigo',
    'natureza_acao',
    'descricao_acao',
    'fase',
    'competencia',
    'tramitacao',
    'observacao',
    'valor_causa',
    'prazo_fatal',
    'proxima_consulta',
    'uf',
    'cidade',
    'ativo',
    'partes_mysql',
    'andamentos_mysql',
    'calculos_mysql',
  ];

  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue;
    const cols = line.split('\t');
    /** @type {Record<string, unknown>} */
    const row = {};
    headers.forEach((h, i) => {
      const val = cols[i];
      row[h] = val === undefined || val === 'NULL' ? null : val;
    });
    map.set(Number(row.numero_interno), row);
  }
  return map;
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function montarLinhaTxt(codNum, proc, base) {
  const cab = lerCabecalhoProcessoTxt(codNum, proc, { baseBanco: base });
  const status = lerStatusProcessoTxt(codNum, proc, { baseBanco: base });
  const partes = lerPartesProcessoTxt(base, codNum, proc);
  const procStr = formatProcNomeArquivo(proc);
  const cod8 = formatCod8(codNum);
  const histIndice = procStr ? lerMaxIndiceHistorico(base, cod8, codNum, procStr) : 0;

  return {
    temCabecalhoTxt: Object.keys(cab.campos).length > 0,
    campos: cab.campos,
    partesTxt: partes.length,
    historicoIndiceMax: histIndice || 0,
    ativoTxt: status.ativo,
    temArquivoStatus: status.temArquivoStatus === true,
    tituloReu61: cab.partesTxt?.tituloReu61 ?? null,
    tituloAutor11: cab.partesTxt?.tituloAutor11 ?? null,
  };
}

/** @param {ReturnType<typeof parseArgs>} opts */
async function montarRelatorio(opts) {
  const codNum = Math.trunc(Number(opts.cliente));
  if (!Number.isFinite(codNum) || codNum < 1) {
    throw new Error('Informe --cliente=N');
  }
  const cod8 = formatCod8(codNum);
  const base = opts.base;

  const procsTxt = listarProcessosDropboxCliente(base, codNum);
  const procsPartesTxt = new Set(listarProcessosComPartesTxt(base, codNum));
  const vpsMap = await carregarVpsPorProc(opts, cod8);
  const procsVps = [...vpsMap.keys()].sort((a, b) => a - b);
  const procsUnion = [...new Set([...procsTxt, ...procsVps])].sort((a, b) => a - b);

  /** @type {object[]} */
  const linhas = [];

  for (const proc of procsUnion) {
    const txt = procsTxt.includes(proc) ? montarLinhaTxt(codNum, proc, base) : null;
    const vps = vpsMap.get(proc) ?? null;

    let situacao = 'ok';
    if (txt && !vps) situacao = 'so_txt';
    else if (!txt && vps) situacao = 'so_vps';
    else if (!txt && !vps) situacao = 'inconsistente';

    /** @type {object[]} */
    const divergencias = [];

    if (txt && vps) {
      for (const [txtKey, vpsKey] of CAMPOS_CABECALHO) {
        const d = cmpCampo(txtKey, txt.campos[txtKey], vps[vpsKey]);
        if (d) divergencias.push(d);
      }
      const dPrazo = cmpCampo('prazoFatal', txt.campos.prazoFatal, vps.prazo_fatal);
      if (dPrazo) divergencias.push(dPrazo);
      const dProx = cmpCampo('proximaConsulta', txt.campos.proximaConsulta, vps.proxima_consulta);
      if (dProx) divergencias.push(dProx);
      const dVal = cmpCampo('valorCausa', txt.campos.valorCausa, vps.valor_causa);
      if (dVal) divergencias.push(dVal);

      const ativoVps = String(vps.ativo) === '1' || vps.ativo === 1 || vps.ativo === true;
      if (txt.temArquivoStatus && txt.ativoTxt !== ativoVps) {
        divergencias.push({ campo: 'ativo', txt: txt.ativoTxt, vps: ativoVps });
      }

      const partesMysql = Number(vps.partes_mysql ?? 0);
      if (txt.partesTxt > 0 && partesMysql === 0) {
        divergencias.push({ campo: 'partes', txt: txt.partesTxt, vps: partesMysql });
      } else if (txt.partesTxt > 0 && partesMysql > 0 && txt.partesTxt !== partesMysql) {
        divergencias.push({ campo: 'partes_qtd', txt: txt.partesTxt, vps: partesMysql });
      }

      const andMysql = Number(vps.andamentos_mysql ?? 0);
      if (txt.historicoIndiceMax > 0 && andMysql === 0) {
        divergencias.push({ campo: 'andamentos', txt: txt.historicoIndiceMax, vps: andMysql });
      }
    }

    if (divergencias.length > 0 && situacao === 'ok') situacao = 'divergente';

    linhas.push({
      codigo_cliente: cod8,
      proc,
      situacao,
      processo_id_vps: vps?.processo_id ?? null,
      divergencias,
      txt: txt
        ? {
            unidade: txt.campos.unidade ?? null,
            numeroCnj: txt.campos.numeroCnj ?? null,
            naturezaAcao: txt.campos.naturezaAcao ?? null,
            descricaoAcao: txt.campos.descricaoAcao ?? null,
            partes: txt.partesTxt,
            historicoIndiceMax: txt.historicoIndiceMax,
            ativo: txt.ativoTxt,
            temPartes90_95: procsPartesTxt.has(proc),
          }
        : null,
      vps: vps
        ? {
            unidade: vps.unidade,
            numero_cnj: vps.numero_cnj,
            natureza_acao: vps.natureza_acao,
            descricao_acao: vps.descricao_acao,
            fase: vps.fase,
            partes: Number(vps.partes_mysql ?? 0),
            andamentos: Number(vps.andamentos_mysql ?? 0),
            calculos: Number(vps.calculos_mysql ?? 0),
            ativo: String(vps.ativo) === '1' || vps.ativo === 1,
          }
        : null,
    });
  }

  const resumo = {
    codigo_cliente: cod8,
    fonte_txt: base,
    fonte_vps: opts.mysqlLocal ? 'mysql-local' : opts.vpsHost,
    processos_txt: procsTxt.length,
    processos_vps: procsVps.length,
    so_txt: linhas.filter((l) => l.situacao === 'so_txt').length,
    so_vps: linhas.filter((l) => l.situacao === 'so_vps').length,
    divergentes: linhas.filter((l) => l.situacao === 'divergente').length,
    ok: linhas.filter((l) => l.situacao === 'ok').length,
    lista_so_txt: linhas.filter((l) => l.situacao === 'so_txt').map((l) => l.proc),
    lista_divergentes: linhas.filter((l) => l.situacao === 'divergente').map((l) => l.proc),
  };

  return { geradoEm: new Date().toISOString(), resumo, linhas };
}

function escreverCsv(rel, csvPath) {
  const lines = [
    [
      'proc',
      'situacao',
      'processo_id_vps',
      'divergencias',
      'txt_unidade',
      'vps_unidade',
      'txt_cnj',
      'vps_cnj',
      'txt_partes',
      'vps_partes',
      'txt_historico_max',
      'vps_andamentos',
      'vps_calculos',
    ].join(','),
  ];
  for (const l of rel.linhas) {
    lines.push(
      [
        l.proc,
        l.situacao,
        l.processo_id_vps ?? '',
        l.divergencias.map((d) => `${d.campo}:${JSON.stringify(d.txt)}→${JSON.stringify(d.vps)}`).join('|'),
        l.txt?.unidade ?? '',
        l.vps?.unidade ?? '',
        l.txt?.numeroCnj ?? '',
        l.vps?.numero_cnj ?? '',
        l.txt?.partes ?? '',
        l.vps?.partes ?? '',
        l.txt?.historicoIndiceMax ?? '',
        l.vps?.andamentos ?? '',
        l.vps?.calculos ?? '',
      ].map(csvEscape).join(','),
    );
  }
  fs.mkdirSync(path.dirname(path.resolve(csvPath)), { recursive: true });
  fs.writeFileSync(csvPath, `${lines.join('\n')}\n`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const rel = await montarRelatorio(opts);

  const defaultDir = path.join(process.cwd(), 'tmp');
  const relPath =
    opts.relatorio ?? path.join(defaultDir, `processos-txt-vs-vps-${formatCod8(opts.cliente)}.json`);
  const csvPath =
    opts.csv ?? path.join(defaultDir, `processos-txt-vs-vps-${formatCod8(opts.cliente)}.csv`);

  fs.mkdirSync(path.dirname(path.resolve(relPath)), { recursive: true });
  fs.writeFileSync(relPath, `${JSON.stringify(rel, null, 2)}\n`);
  escreverCsv(rel, csvPath);

  const s = rel.resumo;
  console.log(`\n=== Cliente ${s.codigo_cliente} — txt vs VPS ===`);
  console.log(`TXT (Dropbox): ${s.processos_txt} processos`);
  console.log(`VPS (MySQL):   ${s.processos_vps} processos`);
  console.log(`Só no TXT:     ${s.so_txt} → [${s.lista_so_txt.join(', ')}]`);
  console.log(`Divergentes:   ${s.divergentes} → [${s.lista_divergentes.join(', ')}]`);
  console.log(`OK:            ${s.ok}`);
  console.log(`\nRelatório: ${relPath}`);
  console.log(`CSV:       ${csvPath}\n`);

  for (const l of rel.linhas) {
    if (l.situacao === 'ok') continue;
    console.log(`--- proc ${l.proc} (${l.situacao}) ---`);
    if (l.situacao === 'so_txt') {
      console.log(`  TXT: unidade=${l.txt?.unidade ?? '—'} cnj=${l.txt?.numeroCnj ?? '—'} partes=${l.txt?.partes ?? 0} histórico≤${l.txt?.historicoIndiceMax ?? 0}`);
      console.log('  VPS: (ausente)');
    } else if (l.divergencias.length) {
      for (const d of l.divergencias) {
        console.log(`  ${d.campo}: txt=${JSON.stringify(d.txt)} | vps=${JSON.stringify(d.vps)}`);
      }
    }
  }
}

main().catch((e) => {
  console.error('[diagnosticar-processos-txt-vs-vps] FATAL:', e?.message ?? e);
  process.exit(1);
});
