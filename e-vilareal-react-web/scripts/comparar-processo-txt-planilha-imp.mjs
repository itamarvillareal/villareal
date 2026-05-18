#!/usr/bin/env node
/**
 * Compara processos importados via TXT com Processos_imp.xls e MySQL.
 *
 *   node scripts/comparar-processo-txt-planilha-imp.mjs
 */

import { execSync } from 'node:child_process';
import XLSX from 'xlsx';
import { levantarDadosProcessoTxt, montarPatchProcessoFromTxt } from './lib/proc-processo-dados-txt.mjs';
import { normalizarTextoPlanilha } from './lib/normalizar-texto-planilha.mjs';

const PLANILHA = '/Users/itamar/Dropbox/sistema/Processos_imp.xls';

const S0 = {
  PESSOA_CLIENTE: 4,
  AUD_DATA: 5,
  AUD_HORA: 6,
  AUD_TIPO: 7,
  OBS_FASE: 8,
  PRAZO_FATAL: 9,
  COMPET: 10,
  DATA_PROT: 11,
  PROC: 13,
  PASTA: 14,
  PROCED: 15,
  UNID: 16,
  RESP: 17,
  VALOR: 18,
  DESC: 20,
  ATIVO_PROC: 21,
};

const S1 = {
  PESSOA_CLIENTE: 4,
  AUTOR: [6, 7, 8, 9, 10],
  REU: [11, 12, 15, 16, 17, 18],
  PROC: 13,
  FASE: 14,
  CNJ: 19,
  DESC: 20,
  PARTE_TEXTO: 21,
};

const PAIRS = [
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

function normKey(s) {
  if (s == null) return '';
  return String(s)
    .trim()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normCnj(s) {
  return String(s ?? '')
    .replace(/\D/g, '')
    .slice(0, 20);
}

function excelDateToIso(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  const t = String(v).trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  if (typeof v === 'number' && v > 1000) {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  return null;
}

function parseValor(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).replace(/R\$\s*/gi, '').trim().replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function cellStr(v) {
  if (v == null) return null;
  const s = normalizarTextoPlanilha(v);
  return s === '' ? null : s;
}

function loadPlanilhaRows() {
  const wb = XLSX.readFile(PLANILHA, { cellDates: true });
  const s0 = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null });
  const s1 = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[1]], { header: 1, defval: null });
  /** @type {Map<string, { row0: unknown[], row1: unknown[], linha: number }>} */
  const map = new Map();

  for (let r = 1; r < s0.length; r++) {
    const proc = Number.parseInt(String(s0[r][S0.PROC] ?? '').replace(/\D/g, ''), 10);
    if (!Number.isFinite(proc)) continue;
    for (const [c] of PAIRS) {
      if (map.has(`${c}|${proc}`)) continue;
      const cod8 = String(c).padStart(8, '0');
      const rowStr = s0[r].map((x) => String(x ?? '')).join('|');
      if (rowStr.includes(cod8) || rowStr.includes(String(c))) {
        map.set(`${c}|${proc}`, { row0: s0[r], row1: s1[r], linha: r + 1 });
        break;
      }
    }
  }
  return map;
}

function planilhaToComparable(row0, row1) {
  const autores = S1.AUTOR.map((i) => cellStr(row1?.[i])).filter(Boolean);
  const reus = S1.REU.map((i) => cellStr(row1?.[i])).filter(Boolean);
  return {
    cnj: cellStr(row1?.[S1.CNJ]),
    descricaoAcao: cellStr(row1?.[S1.DESC]) ?? cellStr(row0?.[S0.DESC]),
    fase: cellStr(row1?.[S1.FASE]),
    observacaoFase: cellStr(row0?.[S0.OBS_FASE]),
    dataProtocolo: excelDateToIso(row0?.[S0.DATA_PROT]),
    prazoFatal: excelDateToIso(row0?.[S0.PRAZO_FATAL]),
    competencia: cellStr(row0?.[S0.COMPET]),
    valorCausa: parseValor(row0?.[S0.VALOR]),
    pasta: cellStr(row0?.[S0.PASTA]),
    procedimento: cellStr(row0?.[S0.PROCED]),
    unidade: cellStr(row0?.[S0.UNID]),
    responsavel: cellStr(row0?.[S0.RESP]),
    audienciaData: excelDateToIso(row0?.[S0.AUD_DATA]),
    audienciaHora: cellStr(row0?.[S0.AUD_HORA]),
    audienciaTipo: cellStr(row0?.[S0.AUD_TIPO]),
    parteTexto: cellStr(row1?.[S1.PARTE_TEXTO]),
    autores,
    reus,
    ativoProc: cellStr(row0?.[S0.ATIVO_PROC]) ?? cellStr(row1?.[S1.ATIVO]),
  };
}

function txtToComparable(dados) {
  const p = montarPatchProcessoFromTxt(dados);
  const { parteClienteNome, parteContraparteNome } = dados.cabecalho.partesTxt;
  return {
    cnj: p.numeroCnj ?? null,
    descricaoAcao: p.descricaoAcao ?? null,
    fase: p.fase ?? dados.fase?.faseCanonica ?? null,
    observacaoFase: p.observacaoFase ?? null,
    dataProtocolo: p.dataProtocolo ?? null,
    prazoFatal: p.prazoFatal ?? null,
    competencia: p.competencia ?? null,
    valorCausa: p.valorCausa ?? null,
    observacao: p.observacao ?? null,
    naturezaAcao: p.naturezaAcao ?? null,
    uf: p.uf ?? null,
    cidade: p.cidade ?? null,
    papelCliente: p.papelCliente ?? null,
    audienciaData: p.audienciaData ?? null,
    audienciaHora: p.audienciaHora ?? null,
    audienciaTipo: p.audienciaTipo ?? null,
    avisoAudiencia: p.avisoAudiencia ?? null,
    parteClienteNome: parteClienteNome ?? null,
    parteContraparteNome: parteContraparteNome ?? null,
    andamentos: dados.entradasHistorico.length,
    statusInativo: dados.fase?.statusInativo ?? false,
  };
}

function loadMysql() {
  const sql =
    "SELECT c.codigo_cliente, pr.numero_interno, pr.numero_cnj, pr.descricao_acao, pr.natureza_acao, pr.fase, pr.observacao_fase, pr.competencia, DATE_FORMAT(pr.data_protocolo,'%Y-%m-%d'), DATE_FORMAT(pr.prazo_fatal,'%Y-%m-%d'), pr.valor_causa, pr.uf, pr.cidade, pr.observacao, pr.papel_cliente, DATE_FORMAT(pr.audiencia_data,'%Y-%m-%d'), pr.audiencia_hora, pr.audiencia_tipo, pr.aviso_audiencia, pr.ativo, (SELECT COUNT(*) FROM vilareal.processo_andamento a WHERE a.processo_id=pr.id AND a.origem='IMPORT_TXT_LOCAL') FROM vilareal.processo pr JOIN vilareal.cliente c ON c.pessoa_id=pr.pessoa_id WHERE (c.codigo_cliente, pr.numero_interno) IN (('00000594',2),('00000560',18),('00000149',7),('00000578',97),('00000533',10),('00000752',190),('00000578',136),('00000715',4),('00000473',12),('00000578',91),('00000578',18),('00000533',14))";
  const out = execSync(`docker exec vilareal-db mysql -uroot -proot -N -e ${JSON.stringify(sql)}`, {
    encoding: 'utf8',
  });
  /** @type {Map<string, object>} */
  const m = new Map();
  for (const line of out.trim().split('\n').filter(Boolean)) {
    const p = line.split('\t');
    const cod = Number.parseInt(String(p[0]).replace(/\D/g, ''), 10);
    const proc = Number.parseInt(p[1], 10);
    m.set(`${cod}|${proc}`, {
      cnj: p[2] || null,
      descricaoAcao: p[3] || null,
      naturezaAcao: p[4] || null,
      fase: p[5] || null,
      observacaoFase: p[6] || null,
      competencia: p[7] || null,
      dataProtocolo: p[8] || null,
      prazoFatal: p[9] || null,
      valorCausa: p[10] != null && p[10] !== '' ? Number(p[10]) : null,
      uf: p[11] || null,
      cidade: p[12] || null,
      observacao: p[13] || null,
      papelCliente: p[14] || null,
      audienciaData: p[15] || null,
      audienciaHora: p[16] || null,
      audienciaTipo: p[17] || null,
      avisoAudiencia: p[18] || null,
      ativo: p[19] === '1',
      andamentos: Number(p[20] || 0),
    });
  }
  return m;
}

function cmpField(nome, a, b, opts = {}) {
  if (a == null && b == null) return { nome, status: 'ambos_vazios' };
  if (a == null || a === '') return { nome, status: 'so_b', valorA: a, valorB: b };
  if (b == null || b === '') return { nome, status: 'so_a', valorA: a, valorB: b };
  if (opts.cnj) {
    const eq = normCnj(a) === normCnj(b) || normCnj(a).includes(normCnj(b)) || normCnj(b).includes(normCnj(a));
    return { nome, status: eq ? 'igual' : 'diverge', valorA: a, valorB: b };
  }
  if (opts.numero) {
    const eq = Math.abs(Number(a) - Number(b)) < 0.02;
    return { nome, status: eq ? 'igual' : 'diverge', valorA: a, valorB: b };
  }
  if (opts.data) {
    const eq = excelDateToIso(a) === excelDateToIso(b);
    return { nome, status: eq ? 'igual' : 'diverge', valorA: a, valorB: b };
  }
  const eq = normKey(a) === normKey(b);
  return { nome, status: eq ? 'igual' : 'diverge', valorA: String(a).slice(0, 80), valorB: String(b).slice(0, 80) };
}

const planMap = loadPlanilhaRows();
const mysqlMap = loadMysql();

console.log(`\nPlanilha: ${PLANILHA}`);
console.log(`Processos na planilha (12 alvo): ${[...PAIRS].filter(([c, p]) => planMap.has(`${c}|${p}`)).length}/12\n`);

const CAMPOS = [
  ['cnj', { cnj: true }],
  ['descricaoAcao', {}],
  ['fase', {}],
  ['observacaoFase', {}],
  ['dataProtocolo', { data: true }],
  ['prazoFatal', { data: true }],
  ['competencia', {}],
  ['valorCausa', { numero: true }],
  ['observacao', {}],
  ['naturezaAcao', {}],
  ['uf', {}],
  ['cidade', {}],
];

/** @type {object[]} */
const resumoGeral = [];

for (const [c, p] of PAIRS) {
  const key = `${c}|${p}`;
  const plan = planMap.get(key);
  const dados = levantarDadosProcessoTxt(c, p);
  const txt = txtToComparable(dados);
  const db = mysqlMap.get(key);

  console.log(`\n${'='.repeat(60)}\nCliente ${c} / Proc ${p}${plan ? ` (planilha L${plan.linha})` : ' — AUSENTE NA PLANILHA'}\n`);

  if (!plan) {
    console.log('  ⚠ Não encontrado em Processos_imp.xls');
    continue;
  }

  const pl = planilhaToComparable(plan.row0, plan.row1);

  const convPlanTxt = [];
  const divPlanTxt = [];
  const soPlan = [];
  const soTxt = [];

  for (const [campo, opts] of CAMPOS) {
    const r = cmpField(campo, pl[campo], txt[campo], opts);
    if (r.status === 'igual' || r.status === 'ambos_vazios') convPlanTxt.push(campo);
    else if (r.status === 'diverge') divPlanTxt.push({ campo, plan: r.valorA, txt: r.valorB });
    else if (r.status === 'so_a') soPlan.push(campo);
    else if (r.status === 'so_b') soTxt.push(campo);
  }

  const convTxtDb = [];
  const divTxtDb = [];
  for (const [campo, opts] of CAMPOS) {
    if (txt[campo] == null && db?.[campo] == null) continue;
    const r = cmpField(campo, txt[campo], db?.[campo], opts);
    if (r.status === 'igual') convTxtDb.push(campo);
    else if (r.status === 'diverge') divTxtDb.push({ campo, txt: r.valorA, db: r.valorB });
  }

  console.log('  Planilha × TXT:');
  console.log(`    Convergem: ${convPlanTxt.join(', ') || '—'}`);
  if (divPlanTxt.length) {
    console.log('    Divergem:');
    for (const d of divPlanTxt) console.log(`      ${d.campo}: plan="${d.plan}" | txt="${d.txt}"`);
  }
  if (soPlan.length) console.log(`    Só planilha: ${soPlan.join(', ')}`);
  if (soTxt.length) console.log(`    Só TXT: ${soTxt.join(', ')}`);

  console.log('  TXT × MySQL (pós-import):');
  console.log(`    Convergem: ${convTxtDb.join(', ') || '—'}`);
  if (divTxtDb.length) {
    for (const d of divTxtDb) console.log(`      ${d.campo}: txt="${d.txt}" | db="${d.db}"`);
  }
  console.log(`    Andamentos: txt=${txt.andamentos} | db=${db?.andamentos ?? '?'}`);

  const extrasTxt = [];
  if (txt.parteClienteNome) extrasTxt.push(`parte1.1=${txt.parteClienteNome.slice(0, 40)}`);
  if (txt.parteContraparteNome) extrasTxt.push(`parte6.1=${txt.parteContraparteNome.slice(0, 40)}`);
  if (pl.autores?.length) extrasTxt.push(`plan.autores=${pl.autores.length} ids`);
  if (pl.reus?.length) extrasTxt.push(`plan.reus=${pl.reus.length} ids`);
  if (extrasTxt.length) console.log(`    Partes: ${extrasTxt.join(' | ')}`);

  if (pl.audienciaData || pl.audienciaHora) {
    console.log(
      `    Audiência planilha: ${pl.audienciaData ?? '—'} ${pl.audienciaHora ?? ''} ${pl.audienciaTipo ?? ''}`
    );
  }
  if (txt.audienciaData || txt.papelCliente) {
    console.log(`    Audiência/papel TXT: ${txt.audienciaData ?? '—'} ${txt.papelCliente ?? ''}`);
  }

  resumoGeral.push({
    c,
    p,
    naPlanilha: true,
    divPlanTxt: divPlanTxt.length,
    soPlan: soPlan.length,
    soTxt: soTxt.length,
    andamentosTxt: txt.andamentos,
    andamentosDb: db?.andamentos,
  });
}

// fix typo motionTxtDb -> divTxtDb in script - I had a typo
console.log('\n\n=== RESUMO GERAL ===');
console.table(resumoGeral);
