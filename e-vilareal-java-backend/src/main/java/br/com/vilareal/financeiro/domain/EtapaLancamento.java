package br.com.vilareal.financeiro.domain;

/**
 * Etapa do workflow de classificação do lançamento. (A coluna {@code status} default "ATIVO" é
 * resíduo de um soft-delete que nunca foi implementado — a exclusão de lançamento é FÍSICA;
 * a coluna sai no lote final de contract.)
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
