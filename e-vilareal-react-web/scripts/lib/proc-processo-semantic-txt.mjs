/**
 * Campos semânticos de processo no legado VB (ficheiros `.Processo<proc>.Processos.txt`).
 *
 * | Campo VB                    | Segmento do nome              | Pasta típica   |
 * |-----------------------------|-------------------------------|----------------|
 * | Cliente Requerente/Requerido | ClienteRequerenteOuRequerido  | Proc/1000/…    |
 * | Aviso de Audiência           | ClienteAvisado                 | Gerais/1000/…  |
 * | Data da Audiência            | DatadaAudiencia                | Gerais/1000/…  |
 * | Hora da Audiência            | HoraAudiencia                  | Gerais/1000/…  |
 * | Tipo de Audiência            | TipodeAudiencia                | Gerais/1000/…  |
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  centenaPastaClienteHistorico,
  formatCod8,
  pastaNumeroClienteHistorico,
  readOneLineFile,
  SEGMENTO_MIL,
} from './historico-local-txt-paths.mjs';
import { resolverBaseBancoDados } from './gerais-fase-processo-txt.mjs';
import { parseDataAudienciaLegadoIso } from './datas-legado-vb.mjs';

export const SEMANTIC_KEYS = {
  PAPEL_CLIENTE: 'ClienteRequerenteOuRequerido',
  AVISO_AUDIENCIA: 'ClienteAvisado',
  AUDIENCIA_DATA: 'DatadaAudiencia',
  AUDIENCIA_HORA: 'HoraAudiencia',
  AUDIENCIA_TIPO: 'TipodeAudiencia',
};

const SUFIXO_PROCESSOS = 'Processos';

/**
 * @param {string} fileName
 * @param {string} semanticSegment
 * @returns {{ cod8: string, codNum: number, numeroInterno: number, semantic: string } | null}
 */
export function parseNomeArquivoSemanticProcesso(fileName, semanticSegment) {
  const base = path.basename(fileName, path.extname(fileName));
  const parts = base.split('.');
  if (parts.length !== 4) return null;

  const codRaw = parts[0];
  if (!/^\d{8}$/.test(codRaw)) return null;
  if (parts[1] !== semanticSegment) return null;
  if (parts[3] !== SUFIXO_PROCESSOS) return null;

  const procSeg = parts[2];
  if (!procSeg.startsWith('Processo')) return null;
  const procRaw = procSeg.slice('Processo'.length);
  if (!procRaw) return null;

  const numeroInterno = Number.parseInt(procRaw, 10);
  if (!Number.isFinite(numeroInterno) || numeroInterno < 1) return null;

  const codNum = Number.parseInt(codRaw, 10);
  return { cod8: codRaw, codNum, numeroInterno, semantic: semanticSegment };
}

/**
 * @param {string} dir
 * @param {string} semanticSegment
 * @param {{ clienteFiltro?: number | null, origem?: string }} [opts]
 */
function* iterarTxtSemanticEmDiretorio(dir, semanticSegment, opts = {}) {
  if (!fs.existsSync(dir)) return;

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const ent of entries) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      yield* iterarTxtSemanticEmDiretorio(abs, semanticSegment, opts);
      continue;
    }
    if (!ent.isFile() || !ent.name.toLowerCase().endsWith('.txt')) continue;

    const parsed = parseNomeArquivoSemanticProcesso(ent.name, semanticSegment);
    if (!parsed) continue;
    if (opts.clienteFiltro != null && parsed.codNum !== opts.clienteFiltro) continue;

    const texto = readOneLineFile(abs);
    yield {
      ...parsed,
      texto: texto ?? '',
      arquivo: abs,
      origem: opts.origem ?? 'desconhecida',
    };
  }
}

export function defaultBaseProcMil() {
  return path.join(resolverBaseBancoDados(), 'Proc', SEGMENTO_MIL);
}

export function defaultBaseGeraisMil() {
  return path.join(resolverBaseBancoDados(), 'Gerais', SEGMENTO_MIL);
}

/** @param {string} baseMil — `Proc/1000` ou `Gerais/1000` */
export function* iterarSemanticTxt(baseMil, semanticSegment, opts = {}) {
  yield* iterarTxtSemanticEmDiretorio(baseMil, semanticSegment, opts);
}

/**
 * @param {string | null | undefined} texto
 * @returns {'REQUERENTE' | 'REQUERIDO' | null}
 */
export function normalizarPapelClienteTxt(texto) {
  const t = String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
  if (!t) return null;
  if (t.includes('REQUERIDO') || t === 'REU') return 'REQUERIDO';
  if (t.includes('REQUERENTE') || t === 'AUTOR') return 'REQUERENTE';
  return null;
}

/**
 * @param {string | null | undefined} texto
 * @returns {'AVISADO' | 'NAO_AVISADO' | null}
 */
export function normalizarAvisoAudienciaTxt(texto) {
  const t = String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
  if (!t) return null;
  if (t.startsWith('N') || t.includes('NAO') || t === '0' || t === 'FALSE') return 'NAO_AVISADO';
  if (t.startsWith('S') || t.includes('AVIS') || t === '1' || t === 'TRUE') return 'AVISADO';
  return null;
}

/**
 * @param {string | null | undefined} texto
 * @returns {string | null} ISO yyyy-MM-dd
 */
export function normalizarDataAudienciaTxt(texto) {
  return parseDataAudienciaLegadoIso(texto);
}

/**
 * @param {string | null | undefined} texto
 * @returns {string | null} HH:mm
 */
export function normalizarHoraAudienciaTxt(texto) {
  const t = String(texto ?? '').trim().replace('.', ':');
  if (!t) return null;
  let m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (m) {
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
  }
  if (/^\d{3,4}$/.test(t)) {
    const d = t.length === 3 ? `0${t}` : t;
    const h = Number(d.slice(0, 2));
    const min = Number(d.slice(2));
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
  }
  return null;
}

/**
 * @param {string | null | undefined} texto
 * @returns {string | null}
 */
export function normalizarTipoAudienciaTxt(texto) {
  const t = String(texto ?? '').trim();
  return t.length > 0 ? t.slice(0, 120) : null;
}

/**
 * Levanta todos os campos semânticos por processo.
 * @param {{ baseProcMil?: string, baseGeraisMil?: string, clienteFiltro?: number | null }} [opts]
 * @returns {Map<string, object>}
 */
export function levantarCamposSemanticosProcesso(opts = {}) {
  const baseProcMil = opts.baseProcMil ?? defaultBaseProcMil();
  const baseGeraisMil = opts.baseGeraisMil ?? defaultBaseGeraisMil();
  const filtro = opts.clienteFiltro ?? null;

  /** @type {Map<string, { cod8: string, codNum: number, numeroInterno: number, campos: Record<string, string>, fontes: Record<string, string> }>} */
  const porChave = new Map();

  function merge(row, campo, valorNormalizado) {
    if (valorNormalizado == null || valorNormalizado === '') return;
    const chave = `${row.cod8}|${row.numeroInterno}`;
    let reg = porChave.get(chave);
    if (!reg) {
      reg = {
        cod8: row.cod8,
        codNum: row.codNum,
        numeroInterno: row.numeroInterno,
        campos: {},
        fontes: {},
      };
      porChave.set(chave, reg);
    }
    reg.campos[campo] = valorNormalizado;
    reg.fontes[campo] = row.arquivo;
  }

  for (const row of iterarSemanticTxt(baseProcMil, SEMANTIC_KEYS.PAPEL_CLIENTE, {
    clienteFiltro: filtro,
    origem: 'Proc/1000',
  })) {
    merge(row, 'papelCliente', normalizarPapelClienteTxt(row.texto));
  }

  for (const row of iterarSemanticTxt(baseGeraisMil, SEMANTIC_KEYS.AVISO_AUDIENCIA, {
    clienteFiltro: filtro,
    origem: 'Gerais/1000',
  })) {
    merge(row, 'avisoAudiencia', normalizarAvisoAudienciaTxt(row.texto));
  }

  for (const row of iterarSemanticTxt(baseGeraisMil, SEMANTIC_KEYS.AUDIENCIA_DATA, {
    clienteFiltro: filtro,
    origem: 'Gerais/1000',
  })) {
    merge(row, 'audienciaData', normalizarDataAudienciaTxt(row.texto));
  }

  for (const row of iterarSemanticTxt(baseGeraisMil, SEMANTIC_KEYS.AUDIENCIA_HORA, {
    clienteFiltro: filtro,
    origem: 'Gerais/1000',
  })) {
    merge(row, 'audienciaHora', normalizarHoraAudienciaTxt(row.texto));
  }

  for (const row of iterarSemanticTxt(baseGeraisMil, SEMANTIC_KEYS.AUDIENCIA_TIPO, {
    clienteFiltro: filtro,
    origem: 'Gerais/1000',
  })) {
    merge(row, 'audienciaTipo', normalizarTipoAudienciaTxt(row.texto));
  }

  return porChave;
}

export { formatCod8, centenaPastaClienteHistorico, pastaNumeroClienteHistorico };
