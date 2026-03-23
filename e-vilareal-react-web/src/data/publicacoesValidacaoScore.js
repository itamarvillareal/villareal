/**
 * Comparação PDF × DataJud (metadados) e score de confiança (determinístico).
 * O teor integral permanece sempre o do PDF.
 */

import { extrairTribunalTextualDoDiario, resolverTribunalDatajudPorCnj } from './publicacoesCnjTribunal.js';

function normSigla(s) {
  return String(s ?? '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Detecta divergência entre tribunal no PDF (diário) e segmento CNJ / retorno DataJud.
 */
export function compararTribunalPdfComCnj(diarioPdf, cnjNormalizado, dadosDatajud) {
  const divergencias = [];
  const tCnj = resolverTribunalDatajudPorCnj(cnjNormalizado);
  const siglaDiario = extrairTribunalTextualDoDiario(diarioPdf);
  if (!tCnj?.sigla) return divergencias;

  const a = siglaDiario ? normSigla(siglaDiario) : '';
  const b = normSigla(tCnj.sigla);
  if (a && b && a !== b && !a.includes(b) && !b.includes(a)) {
    divergencias.push(`Diário (${siglaDiario}) ≠ tribunal do CNJ (${tCnj.sigla})`);
  }

  if (dadosDatajud?.tribunal) {
    const dj = normSigla(String(dadosDatajud.tribunal));
    if (b && dj && !dj.includes(b) && !b.includes(dj)) {
      divergencias.push(`DataJud (${dadosDatajud.tribunal}) ≠ segmento CNJ (${tCnj.sigla})`);
    }
  }

  return divergencias;
}

/**
 * @returns {'alto' | 'medio' | 'baixo'}
 */
export function calcularScoreConfianca({
  processoCnjNormalizado,
  statusTeor,
  statusVinculo,
  datajudResult,
  divergencias = [],
}) {
  let p = 0;
  if (processoCnjNormalizado) p += 2;
  if (statusTeor === 'integral') p += 1;
  if (statusVinculo === 'vinculado') p += 2;
  if (datajudResult?.hit) p += 2;
  else if (datajudResult?.ok && datajudResult?.motivo === 'nao_encontrado') p += 0;
  if (divergencias.length === 0) p += 1;
  if (statusTeor === 'segredo' || statusTeor === 'indisponivel') p -= 1;

  if (p >= 6) return 'alto';
  if (p >= 3) return 'medio';
  return 'baixo';
}

/**
 * Status legível para UI e auditoria.
 */
export function comporStatusValidacaoCnj(datajudResult, divergencias) {
  if (!datajudResult) return 'nao_consultado';
  if (datajudResult.fromCache) {
    /* reutiliza campo motivo do cache */
  }
  if (datajudResult.motivo === 'nao_encontrado') return 'processo_nao_confirmado_cnj';
  if (datajudResult.hit && divergencias.length) return 'divergencia_pdf_cnj';
  if (datajudResult.hit) return 'processo_confirmado_cnj';
  if (datajudResult.motivo === 'tribunal_nao_mapeado') return 'tribunal_nao_mapeado';
  if (datajudResult.motivo === 'nao_autorizado' || datajudResult.motivo === 'rede' || datajudResult.motivo === 'timeout') {
    return 'consulta_indisponivel';
  }
  return 'processo_nao_confirmado_cnj';
}

/**
 * Reconstrói um stub compatível com {@link calcularScoreConfianca} a partir do status já gravado
 * (quando não há objeto DataJud completo em memória).
 */
export function datajudStubFromStatusValidacao(statusValidacaoCnj) {
  const s = statusValidacaoCnj || '';
  if (s === 'processo_confirmado_cnj' || s === 'divergencia_pdf_cnj') return { ok: true, hit: true };
  if (s === 'consulta_indisponivel') return { ok: false, hit: false, motivo: 'rede' };
  if (s === 'nao_consultado') return { ok: false, hit: false, motivo: 'camada2_desligada' };
  if (s === 'tribunal_nao_mapeado') return { ok: false, hit: false, motivo: 'tribunal_nao_mapeado' };
  return { ok: true, hit: false, motivo: 'nao_encontrado' };
}
