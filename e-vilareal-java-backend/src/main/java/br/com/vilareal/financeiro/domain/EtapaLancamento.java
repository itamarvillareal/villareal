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
     * Para conta E com grupo de compensação, use {@link #calcularContaE} quando souber a quantidade no grupo.
     */
    public static EtapaLancamento calcular(String codigoConta, String grupoCompensacao, Long clienteId) {
        if (codigoConta == null || "N".equalsIgnoreCase(codigoConta.trim())) {
            return IMPORTADO;
        }
        if ("E".equalsIgnoreCase(codigoConta.trim())) {
            if (grupoCompensacao != null && !grupoCompensacao.isBlank()) {
                return IMPORTADO;
            }
            return CLASSIFICADO;
        }
        if ("A".equalsIgnoreCase(codigoConta.trim()) && clienteId != null) {
            return VINCULADO;
        }
        return CLASSIFICADO;
    }

    /** Conta E: compensado somente com par (≥2 lançamentos ativos no mesmo grupo). */
    public static EtapaLancamento calcularContaE(String grupoCompensacao, int qtdLancamentosAtivosNoGrupo) {
        if (grupoCompensacao != null && !grupoCompensacao.isBlank()) {
            return qtdLancamentosAtivosNoGrupo >= 2 ? COMPENSADO : IMPORTADO;
        }
        return CLASSIFICADO;
    }
}
