package br.com.vilareal.financeiro.api.dto;

/**
 * Classificação de uma conta bancária (Fase 3, item 3 — FASE B/B3). Fonte de verdade para o frontend
 * (B4) substituir o mapa hardcoded em {@code financeiroData.js}.
 *
 * @param numeroBanco Nº do consolidado/extrato.
 * @param bancoNome   nome canônico do banco.
 * @param tipo        REAL (com extrato) | MANUAL (lançamentos manuais) | VIRTUAL (repasse interno).
 * @param temExtrato  se a conta possui extrato bancário (participa da conciliação por extrato).
 * @param ativo       se a conta está ativa.
 */
public record ContaBancariaResponse(
        Integer numeroBanco,
        String bancoNome,
        String tipo,
        boolean temExtrato,
        boolean ativo,
        String ofxBankId,
        String ofxAgencia,
        String ofxConta) {
}
