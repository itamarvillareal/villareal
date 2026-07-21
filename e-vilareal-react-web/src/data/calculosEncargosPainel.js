/**
 * Resolução de multa/honorários por linha vs painel (paridade entre dimensões).
 * Snapshot legado grava «0»/«0%» como «sem encargo calculado», não como override intencional.
 */

import { parsePercentualBR } from './parcelamentoEntrada.js';

export function parsePercentCalculo(str) {
  const raw = String(str ?? '').trim();
  if (!raw) return 0;
  const n = parsePercentualBR(raw.replace(/R\$\s*/gi, ''));
  return Number.isFinite(n) ? n / 100 : 0;
}

/** @param {Record<string, unknown> | null | undefined} esp */
export function resolveMultaPctLinha(esp, multaPctPainel) {
  const raw = String(esp?.multaEspecial ?? '').trim();
  if (!raw) return multaPctPainel;
  const pct = parsePercentCalculo(raw);
  if (pct === 0) return multaPctPainel;
  return pct;
}

/**
 * @param {Record<string, unknown> | null | undefined} esp
 * @returns {{ honorariosTipoUsado: 'fixos' | 'variaveis', honorPctFixoUsado: number }}
 */
export function resolveHonorariosConfigLinha(esp, honorariosTipoPainel, honorPctFixoPainel) {
  const tipoRaw = String(esp?.honorariosTipoEspecial ?? '').trim();
  let honorariosTipoUsado =
    honorariosTipoPainel === 'variaveis' ? 'variaveis' : 'fixos';
  if (tipoRaw !== '' && tipoRaw !== '0') {
    honorariosTipoUsado = tipoRaw === 'variaveis' ? 'variaveis' : 'fixos';
  }

  const valorRaw = String(esp?.honorariosValorEspecial ?? '').trim();
  let honorPctFixoUsado = honorPctFixoPainel;
  if (valorRaw !== '') {
    const pct = parsePercentCalculo(valorRaw);
    if (pct > 0) honorPctFixoUsado = pct;
  }

  return { honorariosTipoUsado, honorPctFixoUsado };
}
