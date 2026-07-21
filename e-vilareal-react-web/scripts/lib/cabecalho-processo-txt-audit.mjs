/**
 * Comparação cabeçalho processo: txt Dropbox ↔ MySQL/API.
 * Usado por auditar/corrigir-cabecalho e verificação pós-import-real.
 */

import fs from 'node:fs';
import path from 'node:path';

import { lerStatusProcessoTxt, levantarFasesProcessos } from './gerais-fase-processo-txt.mjs';
import {
  formatCod8,
  formatProcNomeArquivo,
  lerMaxIndiceHistorico,
} from './historico-local-txt-paths.mjs';
import { lerCabecalhoProcessoTxt } from './proc-processo-cabecalho-txt.mjs';

/** Campos comparados (chave patch → coluna SQL). */
export const CAMPOS_CABECALHO_AUDIT = [
  ['numeroCnj', 'numero_cnj'],
  ['numeroProcessoAntigo', 'numero_processo_antigo'],
  ['naturezaAcao', 'natureza_acao'],
  ['descricaoAcao', 'descricao_acao'],
  ['competencia', 'competencia'],
  ['tramitacao', 'tramitacao'],
  ['observacao', 'observacao'],
  ['valorCausa', 'valor_causa'],
  ['dataProtocolo', 'data_protocolo'],
  ['prazoFatal', 'prazo_fatal'],
  ['proximaConsulta', 'proxima_consulta'],
  ['uf', 'uf'],
  ['cidade', 'cidade'],
  ['unidade', 'unidade'],
];

/** Divergência nestes campos impede confiança no cadastro. */
export const CAMPOS_CRITICOS = new Set([
  'numeroCnj',
  'descricaoAcao',
  'valorCausa',
  'competencia',
  'observacao',
  'naturezaAcao',
]);

export function normStr(v) {
  const s = String(v ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  return s || null;
}

export function normCnj(v) {
  const s = normStr(v);
  return s ? s.replace(/\s/g, '') : null;
}

export function normValor(v) {
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

export function normDate(v) {
  const s = normStr(v);
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return s;
}

/** @param {string} txtKey @param {unknown} txtVal @param {unknown} dbVal */
export function cmpCampoCabecalho(txtKey, txtVal, dbVal) {
  if (txtKey === 'numeroCnj') {
    const a = normCnj(txtVal);
    const b = normCnj(dbVal);
    return a === b ? null : { campo: txtKey, txt: a, db: b };
  }
  if (txtKey === 'valorCausa') {
    const a = normValor(txtVal);
    const b = normValor(dbVal);
    return a === b ? null : { campo: txtKey, txt: a, db: b };
  }
  if (txtKey === 'prazoFatal' || txtKey === 'proximaConsulta' || txtKey === 'dataProtocolo') {
    const a = normDate(txtVal);
    const b = normDate(dbVal);
    return a === b ? null : { campo: txtKey, txt: a, db: b };
  }
  if (txtKey === 'cidade') {
    const a = normStr(txtVal)?.toUpperCase() ?? null;
    const b = normStr(dbVal)?.toUpperCase() ?? null;
    return a === b ? null : { campo: txtKey, txt: normStr(txtVal), db: normStr(dbVal) };
  }
  const a = normStr(txtVal);
  const b = normStr(dbVal);
  if (a === b) return null;
  if (!a && !b) return null;
  return { campo: txtKey, txt: a, db: b };
}

/**
 * @param {{ campo: string, txt: unknown, db: unknown }} d
 * @returns {'critico' | 'aviso' | 'cosmetico'}
 */
export function severidadeDivergencia(d) {
  if (CAMPOS_CRITICOS.has(d.campo)) {
    // Campo enriquecido na API/Projudi sem txt legado — não bloqueia import.
    if (d.txt == null && d.db != null && d.campo !== 'valorCausa') return 'aviso';
    return 'critico';
  }
  if (d.campo === 'tramitacao' && d.db && !d.txt) return 'aviso';
  if (d.campo === 'prazoFatal' || d.campo === 'proximaConsulta') return 'aviso';
  return 'cosmetico';
}

/**
 * @param {number} codNum
 * @param {number} proc
 * @param {string} baseBanco
 */
export function montarSnapshotTxtCabecalho(codNum, proc, baseBanco) {
  const cab = lerCabecalhoProcessoTxt(codNum, proc, { baseBanco });
  const status = lerStatusProcessoTxt(codNum, proc, { baseBanco });
  const cod8 = formatCod8(codNum);
  const procStr = formatProcNomeArquivo(proc);
  const histIndice = procStr ? lerMaxIndiceHistorico(baseBanco, cod8, codNum, procStr) : 0;
  const faseReg = lerFaseObservacaoProcesso(codNum, proc, baseBanco);

  return {
    temCabecalhoTxt: Object.keys(cab.campos).length > 0,
    temCnjTxt: Boolean(cab.campos.numeroCnj),
    campos: cab.campos,
    partesTxt: cab.partesTxt,
    historicoIndiceMax: histIndice || 0,
    ativoTxt: status.ativo,
    observacaoFaseTxt: faseReg?.observacaoFase ?? null,
    faseTxt: faseReg?.faseCanonica ?? null,
  };
}

/** Leitura leve de fase/obs (sem histórico completo). */
function lerFaseObservacaoProcesso(codNum, proc, baseBanco) {
  const baseFase = path.join(baseBanco, 'fase');
  const baseGeraisMil = path.join(baseBanco, 'Gerais', '1000');
  return (
    levantarFasesProcessos(baseFase, baseGeraisMil, { clienteFiltro: codNum }).find(
      (r) => r.numeroInterno === proc
    ) ?? null
  );
}

/**
 * @param {ReturnType<typeof montarSnapshotTxtCabecalho>} txt
 * @param {Record<string, unknown>} dbRow
 * @param {{ observacaoFaseDb?: string | null }} [opts]
 */
export function compararCabecalhoTxtVsDb(txt, dbRow, opts = {}) {
  /** @type {object[]} */
  const divergencias = [];

  if (!txt.temCabecalhoTxt) {
    return { divergencias, severidadeMax: null, temTxt: false };
  }

  for (const [txtKey, dbKey] of CAMPOS_CABECALHO_AUDIT) {
    const d = cmpCampoCabecalho(txtKey, txt.campos[txtKey], dbRow[dbKey]);
    if (d) divergencias.push({ ...d, severidade: severidadeDivergencia(d) });
  }

  const obsFaseDb = opts.observacaoFaseDb ?? dbRow.observacao_fase;
  const obsFaseTxt = txt.observacaoFaseTxt;
  if (obsFaseTxt == null && normStr(obsFaseDb)) {
    divergencias.push({
      campo: 'observacaoFase',
      txt: null,
      db: normStr(obsFaseDb),
      severidade: 'aviso',
    });
  } else if (obsFaseTxt != null) {
    const d = cmpCampoCabecalho('observacaoFase', obsFaseTxt, obsFaseDb);
    if (d) divergencias.push({ ...d, severidade: 'aviso' });
  }

  const ordem = { critico: 3, aviso: 2, cosmetico: 1 };
  const severidadeMax =
    divergencias.length === 0
      ? null
      : divergencias.reduce(
          (best, d) => (ordem[d.severidade] > ordem[best] ? d.severidade : best),
          'cosmetico'
        );

  return { divergencias, severidadeMax, temTxt: true };
}

/**
 * Varredura única dos txt `5.1` (CNJ) em Gerais/Proc.
 * @param {string} baseBanco
 * @returns {{
 *   porCnj: Map<string, Array<{ cod8: string, codNum: number, numeroInterno: number, arquivo: string, cnj: string }>>,
 *   porProcesso: Map<string, { cnj: string, arquivo: string }>,
 * }}
 */
export function indexarCnj51Txt(baseBanco) {
  /** @type {Map<string, Array<object>>} */
  const porCnj = new Map();
  /** @type {Map<string, { cnj: string, arquivo: string }>} */
  const porProcesso = new Map();
  for (const sub of ['Gerais', 'Proc']) {
    const raiz = path.join(baseBanco, sub, '1000');
    if (!fs.existsSync(raiz)) continue;
    indexarCnjRecursivo(raiz, porCnj, porProcesso);
  }
  return { porCnj, porProcesso };
}

/**
 * Índice CNJ → primeiro dono no txt (`5.1`) — compat.
 * @param {string} baseBanco
 * @returns {Map<string, { cod8: string, codNum: number, numeroInterno: number, arquivo: string }>}
 */
export function indexarCnjTxtGlobal(baseBanco) {
  const { porCnj } = indexarCnj51Txt(baseBanco);
  /** @type {Map<string, object>} */
  const map = new Map();
  for (const [cnj, donos] of porCnj) map.set(cnj, donos[0]);
  return map;
}

/** @param {string} dir @param {Map<string, Array<object>>} porCnj @param {Map<string, object>} porProcesso */
function indexarCnjRecursivo(dir, porCnj, porProcesso) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      indexarCnjRecursivo(abs, porCnj, porProcesso);
      continue;
    }
    if (!ent.isFile() || !/\.5\.1\.\d+\.txt$/i.test(ent.name)) continue;
    const m = /^(\d{8})\.5\.1\.(\d+)\.txt$/i.exec(ent.name);
    if (!m) continue;
    let cnj;
    try {
      cnj = normCnj(fs.readFileSync(abs, 'utf8'));
    } catch {
      continue;
    }
    if (!cnj) continue;
    const cod8 = m[1];
    const codNum = Number.parseInt(cod8, 10);
    const numeroInterno = Number.parseInt(m[2], 10);
    const reg = { cod8, codNum, numeroInterno, arquivo: abs, cnj };
    const lista = porCnj.get(cnj);
    if (lista) lista.push(reg);
    else porCnj.set(cnj, [reg]);
    const chave = `${cod8}|${numeroInterno}`;
    if (!porProcesso.has(chave)) porProcesso.set(chave, { cnj, arquivo: abs });
  }
}

/**
 * CNJ no banco pertence ao txt de outro cliente/processo?
 * @param {string | null | undefined} cnjDb
 * @param {string} cod8Alvo
 * @param {number} procAlvo
 * @param {Map<string, { cod8: string, numeroInterno: number, arquivo: string }>} indiceCnj
 */
export function detectarContaminacaoCnj(cnjDb, cod8Alvo, procAlvo, indiceCnj) {
  const cnj = normCnj(cnjDb);
  if (!cnj) return null;
  const dono = indiceCnj.get(cnj);
  if (!dono) return null;
  if (dono.cod8 === cod8Alvo && dono.numeroInterno === procAlvo) return null;
  return {
    tipo: 'cnj_de_outro_txt',
    cnj,
    donoTxt: `${dono.cod8}/${dono.numeroInterno}`,
    arquivo: dono.arquivo,
  };
}
