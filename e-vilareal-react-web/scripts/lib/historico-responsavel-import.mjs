/**
 * Normalização de responsável (col. F / tipo 17) — alinhada a `import-historico-planilha.mjs`.
 */

import { normalizarTextoPlanilha } from './normalizar-texto-planilha.mjs';

const DETALHE_RESPONSAVEL_MAX = 8000;

const MAPA_RESPONSAVEL_NORMALIZACAO = {
  ITAMAR2: 'ITAMAR',
  ITAMARR: 'ITAMAR',
  'ITAMAR (SALVO AUTOMATICAMENTE)': 'ITAMAR',
  'ANA LUIZA': 'ANA LUISA',
  LUISA: 'ANA LUISA',
  JESSYCA: 'JESSICA',
  '0)': null,
  '24880': null,
  FERNANDAXLS: 'FERNANDA',
  'RELATÓRIO - DÉBITOS CONDOMINIAIS - FERNANDA': 'FERNANDA',
  'RELATÓRIO - DÉBITOS CONDOMINIAIS - SAVIT': 'SAVIT',
  'RELATÓRIO - DÉBITOS CONDOMINIAIS - ITAMAR': 'ITAMAR',
  'RHAYHANNY (2)': 'RHAYHANNY',
  'ADMINISTRAÇÃO DE IMÓVEIS - ISABELLA': 'ISABELLA',
  SISTEMA: null,
  '3 (1))': null,
};

const RESPONSAVEIS_RECONHECIDOS = new Set([
  'KARLA',
  'ISABELLA',
  'ITAMAR',
  'JOABE',
  'ANA LUISA',
  'GIOVANNA',
  'JESSICA',
  'LORENA',
  'VINICIUS',
  'RHAYHANNY',
  'SUZANI',
  'THALITA',
  'IGOR',
  'JACQUELINE',
  'LARISSA',
  'SAVIT',
  'BRUNA',
  'SABRINA',
  'ALINE',
  'LUCAS',
  'FERNANDA',
  'MARESSA',
  'JOÃO PAULO',
  'PATRICIA',
  'PRISCILA',
  'MARIA EDUARDA',
]);

const warnedUnknownResponsavel = new Set();

/**
 * @param {unknown} valorBruto
 * @param {number} [linhaRef] — só para aviso
 * @returns {string | null}
 */
export function normalizarResponsavelHistorico(valorBruto, linhaRef = 0) {
  if (valorBruto == null) return null;
  const trim = normalizarTextoPlanilha(valorBruto);
  if (!trim) return null;
  if (/^\d+$/.test(trim)) return null;
  if (/^[\d\s.,-]+$/.test(trim) && /\d/.test(trim) && !/[A-Za-zÀ-ÿ]/.test(trim)) return null;
  const upper = trim.toUpperCase();
  const normalizado = upper in MAPA_RESPONSAVEL_NORMALIZACAO ? MAPA_RESPONSAVEL_NORMALIZACAO[upper] : upper;
  if (normalizado === null) return null;
  if (RESPONSAVEIS_RECONHECIDOS.has(normalizado)) return normalizado;
  const livre = trim.length > DETALHE_RESPONSAVEL_MAX ? trim.slice(0, DETALHE_RESPONSAVEL_MAX) : trim;
  const key = livre.slice(0, 120);
  if (!warnedUnknownResponsavel.has(key)) {
    warnedUnknownResponsavel.add(key);
    const ref = linhaRef > 0 ? ` (ref. ${linhaRef})` : '';
    console.warn(
      `[responsavel] nome não catalogado "${trim.slice(0, 200)}" → detalhe texto livre${ref}`
    );
  }
  return livre;
}

export function resetAvisosResponsavel() {
  warnedUnknownResponsavel.clear();
}
