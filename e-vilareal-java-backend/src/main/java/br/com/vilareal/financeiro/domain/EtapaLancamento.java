package br.com.vilareal.financeiro.domain;

/**
 * Etapa do workflow de classificação do lançamento.
 * Soft-delete operacional: {@link StatusLancamento#APOSENTADO} (leituras filtram {@link StatusLancamento#ATIVO}).
 * Exclusão definitiva continua FÍSICA via {@code removerLancamento}.
 */
public enum EtapaLancamento {
    IMPORTADO,
    CLASSIFICADO,
    COMPENSADO,
    VINCULADO,
    FECHADO;

    /**
     * Determina a etapa com base na conta contábil e vínculos do lançamento.
     */
    public static EtapaLancamento calcular(String codigoConta, String grupoCompensacao, Long clienteId) {
        if (codigoConta == null || "N".equalsIgnoreCase(codigoConta.trim())) {
            return IMPORTADO;
        }
        if ("E".equalsIgnoreCase(codigoConta.trim())
                && grupoCompensacao != null
                && !grupoCompensacao.isBlank()) {
            return COMPENSADO;
        }
        if ("A".equalsIgnoreCase(codigoConta.trim()) && clienteId != null) {
            return VINCULADO;
        }
        return CLASSIFICADO;
    }
}
