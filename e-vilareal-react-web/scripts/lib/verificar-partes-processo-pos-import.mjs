/**
 * Verificação estrita: cada linha 90/95 do txt deve existir na API (polo + ordem + pessoaId).
 */

import { POLO_PROCESSO_PARTE_OPOSTA } from './legado-pessoa-cliente-vs-partes-processo.mjs';
import { parteTxtParaApiBody } from './proc-processo-partes-txt.mjs';

/**
 * @param {string} polo
 * @param {number} ordem
 * @param {number | null | undefined} pessoaId
 */
export function chaveParteImport(polo, ordem, pessoaId) {
  const p = String(polo ?? '')
    .trim()
    .toUpperCase();
  const o = Number(ordem);
  const pid = Number(pessoaId);
  return `${p}|${Number.isFinite(o) ? o : 0}|${Number.isFinite(pid) && pid > 0 ? pid : '—'}`;
}

/**
 * @param {import('./proc-processo-partes-txt.mjs').ParteProcessoTxt} pt
 * @param {string | null | undefined} [papelCliente]
 */
export function chaveParteTxt(pt, papelCliente = null) {
  const body = parteTxtParaApiBody(pt, papelCliente);
  return chaveParteImport(body.polo, body.ordem, body.pessoaId);
}

/**
 * @param {object} apiParte
 */
export function chaveParteApi(apiParte) {
  return chaveParteImport(apiParte?.polo, apiParte?.ordem, apiParte?.pessoaId);
}

/**
 * @param {import('./proc-processo-partes-txt.mjs').ParteProcessoTxt[]} partesTxt
 * @param {object[]} partesApi
 * @param {string | null | undefined} [papelCliente]
 */
export function verificarPartesTxtContraApi(partesTxt, partesApi, papelCliente = null) {
  const apiPorChave = new Map();
  for (const p of partesApi || []) {
    apiPorChave.set(chaveParteApi(p), p);
  }

  /** @type {object[]} */
  const faltas = [];
  for (const pt of partesTxt || []) {
    if (pt.pessoaId == null) continue;
    const ck = chaveParteTxt(pt, papelCliente);
    if (!apiPorChave.has(ck)) {
      faltas.push({
        chave: ck,
        ladoVba: pt.ladoVba,
        ordem: pt.ordem,
        pessoaId: pt.pessoaId,
        fontes: pt.fontes,
      });
    }
  }

  return { ok: faltas.length === 0, faltas };
}

/**
 * @param {import('./proc-processo-partes-txt.mjs').ParteProcessoTxt[]} partesTxt
 * @param {string | null | undefined} parteOpostaApi
 * @param {object[]} [partesApi]
 */
export function verificarParteOpostaListagem(partesTxt, parteOpostaApi, partesApi) {
  const temReuTxt = (partesTxt || []).some(
    (p) => p.ladoVba === POLO_PROCESSO_PARTE_OPOSTA && p.pessoaId != null
  );
  if (!temReuTxt) return { ok: true, motivo: null };

  const temReuApi = (partesApi || []).some((p) => {
    const polo = String(p.polo ?? '')
      .trim()
      .toUpperCase();
    const pid = Number(p.pessoaId);
    return (polo.includes('REU') || polo.includes('REQUERIDO')) && Number.isFinite(pid) && pid > 0;
  });
  if (temReuApi) return { ok: true, motivo: null };

  const po = String(parteOpostaApi ?? '').trim();
  if (po) return { ok: true, motivo: null };
  return { ok: false, motivo: 'réu no txt sem polo REU na API nem parteOposta na listagem' };
}
