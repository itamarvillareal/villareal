/**
 * Cabeçalho do processo — tipos numéricos VB em `Proc/1000/…` e `Gerais/1000/…`.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  centenaPastaClienteHistorico,
  formatCod8,
  formatProcNomeArquivo,
  pastaNumeroClienteHistorico,
  readOneLineFile,
  SEGMENTO_MIL,
} from './historico-local-txt-paths.mjs';
import { parseDataCabecalhoProcessoIso } from './datas-legado-vb.mjs';
import { parseDataPrazoFatalTxt } from './gerais-145-1-prazo-fatal.mjs';
import { resolverBaseBancoDados } from './gerais-fase-processo-txt.mjs';

/** @typedef {'proc' | 'gerais'} PastaTipo */

/**
 * @type {Record<string, { campo: string, pasta: PastaTipo, truncar?: number }>}
 */
export const MAPA_TIPO_NUMERICO_VB = {
  '1.1': { campo: '_parteClienteNome', pasta: 'proc' },
  '3.1': { campo: 'dataProtocolo', pasta: 'proc' },
  '4.1': { campo: 'numeroProcessoAntigo', pasta: 'gerais', truncar: 100 },
  '5.1': { campo: 'numeroCnj', pasta: 'gerais', truncar: 100 },
  '6.1': { campo: '_parteContraparteNome', pasta: 'proc' },
  '7.1': { campo: 'descricaoAcao', pasta: 'proc' },
  '8.1': { campo: 'naturezaAcao', pasta: 'gerais', truncar: 255 },
  '9.1': { campo: 'valorCausa', pasta: 'gerais' },
  '11.1': { campo: 'uf', pasta: 'proc', truncar: 2 },
  '12.1': { campo: 'cidade', pasta: 'proc', truncar: 120 },
  '13.1': { campo: 'competencia', pasta: 'proc', truncar: 120 },
  '19.1': { campo: 'observacao', pasta: 'gerais' },
  '20.1': { campo: '_responsavelNome', pasta: 'gerais' },
  '0.88.1': { campo: 'unidade', pasta: 'gerais', truncar: 32 },
  '145.1': { campo: 'prazoFatal', pasta: 'gerais' },
  '148.1': { campo: 'proximaConsulta', pasta: 'gerais' },
};

const LIM = {
  uf: 2,
  cidade: 120,
  competencia: 120,
  numeroCnj: 100,
  numeroProcessoAntigo: 100,
  naturezaAcao: 255,
  unidade: 32,
};

/** @deprecated Use parseDataCabecalhoProcessoIso */
export function parseDataCabecalhoIso(texto) {
  return parseDataCabecalhoProcessoIso(texto);
}

/**
 * @param {string | null | undefined} val
 * @param {number} [max]
 */
function truncar(val, max) {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s) return null;
  if (!max) return s;
  const chars = [...s];
  return chars.length <= max ? s : chars.slice(0, max).join('');
}

/**
 * @param {string | null | undefined} texto
 * @returns {number | null}
 */
export function parseValorCausaTxt(texto) {
  if (texto == null) return null;
  const s = String(texto)
    .trim()
    .replace(/R\$\s*/gi, '')
    .replace(/\s/g, '');
  if (!s) return null;
  const norm = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {string} baseMil
 * @param {number} codNum
 * @param {number} numeroInterno
 * @param {string} tipoMeio ex. `5.1`
 * @returns {string | null}
 */
export function caminhoArquivoTipoNumerico(baseMil, codNum, numeroInterno, tipoMeio) {
  const cent = centenaPastaClienteHistorico(codNum);
  const pastaCli = pastaNumeroClienteHistorico(codNum);
  const cod8 = formatCod8(codNum);
  const procSeg = formatProcNomeArquivo(numeroInterno);
  if (!procSeg) return null;
  const nome = `${cod8}.${tipoMeio}.${procSeg}.txt`;
  return path.join(baseMil, String(cent), pastaCli, nome);
}

/**
 * @param {string} baseBanco
 * @param {number} codNum
 * @param {number} numeroInterno
 * @param {string} tipoMeio
 * @param {PastaTipo} pastaTipo
 */
function lerTextoTipo(baseBanco, codNum, numeroInterno, tipoMeio, pastaTipo) {
  const baseMil = path.join(
    baseBanco,
    pastaTipo === 'proc' ? 'Proc' : 'Gerais',
    SEGMENTO_MIL
  );
  const abs = caminhoArquivoTipoNumerico(baseMil, codNum, numeroInterno, tipoMeio);
  if (!abs || !fs.existsSync(abs)) return { texto: null, arquivo: null };
  return { texto: readOneLineFile(abs), arquivo: abs };
}

/**
 * @param {string} tipoMeio
 * @param {string | null} texto
 * @param {object} meta
 */
function normalizarValorTipo(tipoMeio, texto, meta) {
  if (texto == null) return null;
  const t = String(texto).trim();
  if (!t) return null;

  if (tipoMeio === '9.1') return parseValorCausaTxt(t);
  if (tipoMeio === '3.1' || tipoMeio === '148.1') {
    return parseDataCabecalhoProcessoIso(t);
  }
  if (tipoMeio === '145.1') {
    return parseDataCabecalhoProcessoIso(t) ?? parseDataPrazoFatalTxt(t);
  }
  if (meta.truncar) return truncar(t, meta.truncar);
  if (meta.campo === 'uf') return truncar(t.toUpperCase(), LIM.uf);
  if (meta.campo === 'cidade') return truncar(t, LIM.cidade);
  if (meta.campo === 'competencia') return truncar(t, LIM.competencia);
  if (meta.campo === 'numeroCnj') return truncar(t, LIM.numeroCnj);
  if (meta.campo === 'numeroProcessoAntigo') return truncar(t, LIM.numeroProcessoAntigo);
  if (meta.campo === 'naturezaAcao') return truncar(t, LIM.naturezaAcao);
  return t;
}

/**
 * Prazo fatal em `Gerais/145.1/aaaa/mm/` (estrutura legada).
 * @param {string} baseBanco
 * @param {number} codNum
 * @param {number} numeroInterno
 * @returns {{ iso: string | null, arquivo: string | null }}
 */
export function lerPrazoFatalArvore145_1(baseBanco, codNum, numeroInterno) {
  const base = path.join(baseBanco, 'Gerais', '145.1');
  if (!fs.existsSync(base)) return { iso: null, arquivo: null };

  const cod8 = formatCod8(codNum);
  const procSeg = formatProcNomeArquivo(numeroInterno);
  const nome = `${cod8}.145.1.${procSeg}.txt`;

  /** @type {{ iso: string, arquivo: string, score: number } | null} */
  let melhor = null;

  let anos;
  try {
    anos = fs
      .readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{4}$/.test(d.name))
      .map((d) => Number(d.name));
  } catch {
    return { iso: null, arquivo: null };
  }

  for (const yyyy of anos) {
    const dirAno = path.join(base, String(yyyy));
    let meses;
    try {
      meses = fs.readdirSync(dirAno, { withFileTypes: true }).filter((d) => d.isDirectory());
    } catch {
      continue;
    }
    for (const m of meses) {
      const mm = Number(m.name);
      if (!Number.isFinite(mm) || mm < 1 || mm > 12) continue;
      const abs = path.join(dirAno, m.name, nome);
      if (!fs.existsSync(abs)) continue;
      const raw = readOneLineFile(abs);
      const iso = parseDataPrazoFatalTxt(raw, mm);
      if (!iso) continue;
      const score = yyyy * 100 + mm;
      if (!melhor || score > melhor.score) {
        melhor = { iso, arquivo: abs, score };
      }
    }
  }

  return melhor ? { iso: melhor.iso, arquivo: melhor.arquivo } : { iso: null, arquivo: null };
}

/**
 * @param {number} codNum
 * @param {number} numeroInterno
 * @param {{ baseBanco?: string }} [opts]
 */
export function lerCabecalhoProcessoTxt(codNum, numeroInterno, opts = {}) {
  const baseBanco = opts.baseBanco ?? resolverBaseBancoDados();
  const cod8 = formatCod8(codNum);

  /** @type {Record<string, unknown>} */
  const campos = {};
  /** @type {Record<string, string>} */
  const fontes = {};
  /** @type {string[]} */
  const avisos = [];

  /** @type {{ parteClienteNome?: string, parteContraparteNome?: string, responsavelNome?: string }} */
  const partesTxt = {};

  for (const [tipoMeio, meta] of Object.entries(MAPA_TIPO_NUMERICO_VB)) {
    const { texto, arquivo } = lerTextoTipo(baseBanco, codNum, numeroInterno, tipoMeio, meta.pasta);
    if (!arquivo) continue;

    const valor = normalizarValorTipo(tipoMeio, texto, meta);
    if (valor == null || valor === '') continue;

    if (meta.campo === '_parteClienteNome') {
      partesTxt.parteClienteNome = String(valor);
      fontes.parteClienteNome = arquivo;
      continue;
    }
    if (meta.campo === '_parteContraparteNome') {
      partesTxt.parteContraparteNome = String(valor);
      fontes.parteContraparteNome = arquivo;
      continue;
    }
    if (meta.campo === '_responsavelNome') {
      partesTxt.responsavelNome = String(valor);
      fontes.responsavelNome = arquivo;
      continue;
    }

    campos[meta.campo] = valor;
    fontes[meta.campo] = arquivo;
  }

  const prazoArvore = lerPrazoFatalArvore145_1(baseBanco, codNum, numeroInterno);
  if (prazoArvore.iso) {
    if (!campos.prazoFatal || prazoArvore.arquivo) {
      campos.prazoFatal = prazoArvore.iso;
      fontes.prazoFatal = prazoArvore.arquivo ?? fontes.prazoFatal;
    }
  }

  return {
    cod8,
    codNum,
    numeroInterno,
    campos,
    fontes,
    avisos,
    partesTxt,
  };
}
