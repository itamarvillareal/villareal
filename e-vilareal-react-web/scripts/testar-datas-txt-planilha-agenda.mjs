#!/usr/bin/env node
/**
 * Testes: datas TXT × planilha (top 12) e audiência × agenda Docker.
 *
 *   node scripts/testar-datas-txt-planilha-agenda.mjs
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
import { levantarDadosProcessoTxt, montarPatchProcessoFromTxt } from './lib/proc-processo-dados-txt.mjs';
import {
  audienciaStorageParaExibicaoVB,
  parseDataAudienciaLegadoIso,
  parseDataCabecalhoProcessoIso,
  parseDataPlanilhaCellIso,
} from './lib/datas-legado-vb.mjs';
import { lerCabecalhoProcessoTxt } from './lib/proc-processo-cabecalho-txt.mjs';
import {
  formatCod8,
  formatProcNomeArquivo,
  centenaPastaClienteHistorico,
  pastaNumeroClienteHistorico,
  readOneLineFile,
} from './lib/historico-local-txt-paths.mjs';
import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';
import { SEMANTIC_KEYS } from './lib/proc-processo-semantic-txt.mjs';

const PLANILHA = '/Users/itamar/Dropbox/sistema/Processos_imp.xls';

const PAIRS_TOP12 = [
  [594, 2],
  [560, 18],
  [149, 7],
  [578, 97],
  [533, 10],
  [752, 190],
  [578, 136],
  [715, 4],
  [473, 12],
  [578, 91],
  [578, 18],
  [533, 14],
];

const PESSOA_POR_CLIENTE = new Map([
  [594, 1693],
  [560, 379],
  [149, 868],
  [578, 378],
  [533, 362],
  [752, 1247],
  [715, 717],
  [473, 2053],
]);

const S0 = { DATA_PROT: 11, PRAZO_FATAL: 9, AUD_DATA: 5, AUD_HORA: 6 };
const S1 = { PESSOA_CLIENTE: 4, PROC: 13 };

function loadPlanilhaRows(pairs) {
  const wb = XLSX.readFile(PLANILHA, { cellDates: true });
  const s0 = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null });
  const s1 = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[1]], { header: 1, defval: null });
  const map = new Map();
  for (let r = 1; r < s1.length; r++) {
    const proc = Number.parseInt(String(s1[r][S1.PROC] ?? '').replace(/\D/g, ''), 10);
    const pessoaId = Number.parseInt(String(s1[r][S1.PESSOA_CLIENTE] ?? '').replace(/\D/g, ''), 10);
    if (!Number.isFinite(proc) || !Number.isFinite(pessoaId)) continue;
    for (const [c, p] of pairs) {
      if (PESSOA_POR_CLIENTE.get(c) !== pessoaId || p !== proc) continue;
      map.set(`${c}|${p}`, { row0: s0[r], linha: r + 1 });
    }
  }
  return map;
}

function caminhoTxtAudiencia(codNum, numeroInterno) {
  const base = path.join(resolverBaseBancoDados(), 'Gerais', '1000');
  const cod8 = formatCod8(codNum);
  const procSeg = formatProcNomeArquivo(numeroInterno);
  const cent = centenaPastaClienteHistorico(codNum);
  const pasta = pastaNumeroClienteHistorico(codNum);
  return path.join(
    base,
    String(cent),
    pasta,
    `${cod8}.${SEMANTIC_KEYS.AUDIENCIA_DATA}.Processo${procSeg}.Processos.txt`
  );
}

function caminhoTxtHoraAudiencia(codNum, numeroInterno) {
  const base = path.join(resolverBaseBancoDados(), 'Gerais', '1000');
  const cod8 = formatCod8(codNum);
  const procSeg = formatProcNomeArquivo(numeroInterno);
  const cent = centenaPastaClienteHistorico(codNum);
  const pasta = pastaNumeroClienteHistorico(codNum);
  return path.join(
    base,
    String(cent),
    pasta,
    `${cod8}.${SEMANTIC_KEYS.AUDIENCIA_HORA}.Processo${procSeg}.Processos.txt`
  );
}

function mysqlCount(sql) {
  const out = execSync(`docker exec vilareal-db mysql -uroot -proot -N -e ${JSON.stringify(sql)}`, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return Number(out.trim().split('\n')[0] || 0);
}

function buscarAgendaPorDataHoraCnj(dataIso, hora, cnjFrag) {
  if (!dataIso || !cnjFrag || cnjFrag.length < 6) return 0;
  const frag = String(cnjFrag).replace(/\D/g, '').slice(-12);
  const horaSql = hora
    ? `AND (ae.hora_evento = '${hora}' OR ae.hora_evento IS NULL OR ae.hora_evento = '')`
    : '';
  const sql = `SELECT COUNT(*) FROM vilareal.agenda_evento ae WHERE ae.data_evento = '${dataIso}' ${horaSql} AND REPLACE(REPLACE(ae.descricao,'.',''),'-','') LIKE '%${frag}%'`;
  return mysqlCount(sql);
}

function listarParesComTxtAudiencia(limite = 40) {
  const base = path.join(resolverBaseBancoDados(), 'Gerais', '1000');
  /** @type {[number, number][]} */
  const out = [];
  function walk(dir) {
    if (!fs.existsSync(dir) || out.length >= limite) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (out.length >= limite) break;
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(abs);
      else if (ent.isFile() && ent.name.includes('DatadaAudiencia')) {
        const m = /^(\d{8})\.DatadaAudiencia\.Processo(\d+)\.Processos\.txt$/i.exec(ent.name);
        if (m) out.push([Number.parseInt(m[1], 10), Number.parseInt(m[2], 10)]);
      }
    }
  }
  walk(base);
  return out;
}

/** Parser antigo (mm/dd direto) para comparação. */
function parseDataAudienciaMmDdDireto(texto) {
  const t = String(texto ?? '').trim();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (!m) return null;
  const mo = Number(m[1]);
  const dd = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mo < 1 || mo > 12 || dd < 1 || dd > 31) return null;
  return `${yyyy}-${String(mo).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

console.log('\n=== 1) TXT × Planilha — top 12 (datas de protocolo) ===\n');

const planMap = loadPlanilhaRows(PAIRS_TOP12);
/** @type {object[]} */
const testesPlan = [];

for (const [c, p] of PAIRS_TOP12) {
  const key = `${c}|${p}`;
  const plan = planMap.get(key);
  const cab = lerCabecalhoProcessoTxt(c, p);
  const txtIso = cab.campos.dataProtocolo ?? null;
  const planIso = plan ? parseDataPlanilhaCellIso(plan.row0[S0.DATA_PROT]) : null;
  if (!txtIso && !planIso) continue;
  testesPlan.push({
    id: `plan-${c}-${p}`,
    proc: `${c}/${p}`,
    txtIso,
    planIso,
    ok: txtIso === planIso,
    linha: plan?.linha,
  });
}

const planOk = testesPlan.filter((t) => t.ok).length;
for (const t of testesPlan) {
  const st = t.ok ? 'OK' : 'DIV';
  console.log(`  [${st}] ${t.proc} txt=${t.txtIso} plan=${t.planIso} (L${t.linha})`);
}
console.log(`\nSubtotal: ${testesPlan.length} testes | ${planOk} OK | ${testesPlan.length - planOk} divergem\n`);

console.log('=== 2) Audiência TXT × Agenda Docker (amostra com ficheiro DatadaAudiencia) ===\n');

const paresAud = listarParesComTxtAudiencia(35);
/** @type {object[]} */
const testesAgenda = [];

for (const [c, p] of paresAud) {
  const abs = caminhoTxtAudiencia(c, p);
  if (!fs.existsSync(abs)) continue;
  const raw = readOneLineFile(abs)?.trim();
  if (!raw) continue;

  const cab = lerCabecalhoProcessoTxt(c, p);
  const cnj = cab.campos.numeroCnj ?? null;
  const horaPath = caminhoTxtHoraAudiencia(c, p);
  const hora = fs.existsSync(horaPath) ? readOneLineFile(horaPath)?.trim()?.replace('.', ':') : null;

  const isoVb = parseDataAudienciaLegadoIso(raw);
  const isoMmDd = parseDataAudienciaMmDdDireto(raw);
  const exib = audienciaStorageParaExibicaoVB(raw);

  const cntVb = buscarAgendaPorDataHoraCnj(isoVb, hora, cnj);
  const cntMm = isoMmDd && isoMmDd !== isoVb ? buscarAgendaPorDataHoraCnj(isoMmDd, hora, cnj) : 0;

  let resultado = 'sem_match';
  let isoUsado = isoVb;
  if (cntVb > 0) resultado = 'ok_vb';
  else if (cntMm > 0) {
    resultado = 'ok_só_mmdd';
    isoUsado = isoMmDd;
  }

  testesAgenda.push({
    id: `aud-${c}-${p}`,
    proc: `${c}/${p}`,
    raw,
    exib,
    isoVb,
    isoMmDd,
    hora,
    cnj: cnj ? String(cnj).slice(0, 25) : '—',
    cntVb,
    cntMm,
    resultado,
    isoUsado,
  });
}

let audOk = 0;
let audPrecisaFix = 0;
for (const t of testesAgenda) {
  if (t.resultado === 'ok_vb') audOk += 1;
  if (t.resultado === 'ok_só_mmdd') audPrecisaFix += 1;
  const st =
    t.resultado === 'ok_vb'
      ? 'OK'
      : t.resultado === 'ok_só_mmdd'
        ? 'FIX?'
        : '—';
  console.log(
    `  [${st}] ${t.proc} raw="${t.raw}" exib="${t.exib}" iso=${t.isoVb} mmdd=${t.isoMmDd} cnj=${t.cnj} agenda_vb=${t.cntVb} agenda_mmdd=${t.cntMm}`
  );
}

console.log(`\nSubtotal: ${testesAgenda.length} testes | ${audOk} OK (parser VB) | ${audPrecisaFix} só com mm/dd antigo | ${testesAgenda.length - audOk - audPrecisaFix} sem match CNJ\n`);

const totalTestes = testesPlan.length + testesAgenda.length;
const adequacaoNecessaria = audPrecisaFix > 0;

console.log('=== Resumo ===');
console.log(`Total de testes: ${totalTestes}`);
console.log(`  Planilha (protocolo): ${testesPlan.length}`);
console.log(`  Agenda (audiência): ${testesAgenda.length}`);
console.log(`Adequação do script de audiência necessária: ${adequacaoNecessaria ? 'SIM' : 'NÃO'}`);
if (testesPlan.length - planOk > 0) {
  console.log(
    `Nota: ${testesPlan.length - planOk} divergência(s) TXT×planilha em data protocolo podem ser planilha desatualizada (serial Excel), não erro de parser.`
  );
}

process.exit(adequacaoNecessaria ? 2 : 0);
