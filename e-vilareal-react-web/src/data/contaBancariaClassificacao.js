/**
 * Classificação de contas bancárias (Fase 3, item 3 — FASE B/B4).
 *
 * A FONTE de verdade da distinção manual/real/virtual passa a ser o endpoint
 * `GET /api/financeiro/contas-bancarias` (tipo/temExtrato), buscado uma vez e cacheado no
 * `FinanceiroContext`. Este módulo apenas constrói o mapa a partir da resposta e oferece um
 * FALLBACK hardcoded (segurança de transição) caso o fetch demore ou falhe.
 *
 * O fallback reproduz exatamente o que era implícito em `financeiroData.js`:
 *   9/17/18 = MANUAL (sem extrato); 900 = VIRTUAL (repasse interno, com extrato); demais = REAL (com extrato).
 *
 * O fallback sai na FASE C.
 */

/** Classificação implícita anterior (hardcode). Só usado quando o endpoint não está disponível. */
export const CONTA_CLASSIFICACAO_FALLBACK = Object.freeze({
  9: { tipo: 'MANUAL', temExtrato: false },
  17: { tipo: 'MANUAL', temExtrato: false },
  18: { tipo: 'MANUAL', temExtrato: false },
  900: { tipo: 'VIRTUAL', temExtrato: true },
});

/** Default para qualquer conta não listada no fallback: real, com extrato (coerente com o backend). */
export const CLASSIFICACAO_PADRAO = Object.freeze({ tipo: 'REAL', temExtrato: true });

/**
 * Constrói o mapa numeroBanco → { tipo, temExtrato, bancoNome, ativo } a partir da resposta do endpoint.
 * Resposta vazia/ausente → mapa de fallback hardcoded (mesmas contas manuais/virtual de antes).
 */
export function buildClassificacaoContasPorNumero(contasApi) {
  const lista = Array.isArray(contasApi) ? contasApi : [];
  if (lista.length === 0) {
    return { ...CONTA_CLASSIFICACAO_FALLBACK };
  }
  const map = {};
  for (const c of lista) {
    const numero = Number(c?.numeroBanco);
    if (!Number.isFinite(numero)) continue;
    map[numero] = {
      tipo: c?.tipo ?? CLASSIFICACAO_PADRAO.tipo,
      temExtrato: c?.temExtrato ?? CLASSIFICACAO_PADRAO.temExtrato,
      bancoNome: c?.bancoNome ?? null,
      ativo: c?.ativo ?? true,
    };
  }
  return map;
}

/** Classificação de um banco no mapa, com fallback hardcoded e default REAL/com-extrato. */
export function classificacaoConta(numeroBanco, classificacaoPorNumero) {
  const n = Number(numeroBanco);
  if (!Number.isFinite(n)) return { ...CLASSIFICACAO_PADRAO };
  return (
    classificacaoPorNumero?.[n] ??
    CONTA_CLASSIFICACAO_FALLBACK[n] ??
    { ...CLASSIFICACAO_PADRAO }
  );
}

/** Conta lançada à mão (sem extrato). */
export function isContaManual(numeroBanco, classificacaoPorNumero) {
  return classificacaoConta(numeroBanco, classificacaoPorNumero).tipo === 'MANUAL';
}

/** Conta virtual (repasse interno; extrato espelhado débito/crédito, sem importação bancária). */
export function isContaVirtual(numeroBanco, classificacaoPorNumero) {
  return classificacaoConta(numeroBanco, classificacaoPorNumero).tipo === 'VIRTUAL';
}

/** Conta com extrato bancário (participa da conciliação por extrato). */
export function contaTemExtrato(numeroBanco, classificacaoPorNumero) {
  return classificacaoConta(numeroBanco, classificacaoPorNumero).temExtrato === true;
}
