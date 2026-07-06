package br.com.vilareal.citacao.domain;

import br.com.vilareal.common.exception.BusinessRuleException;

import java.util.Set;

public final class CitacaoStatus {

    public static final String SOLICITADO = "SOLICITADO";
    public static final String NEGATIVO = "NEGATIVO";
    public static final String POSITIVO = "POSITIVO";
    /** Reservado — não usar ainda. */
    public static final String PENDENTE = "PENDENTE";

    private static final Set<String> VALIDOS = Set.of(SOLICITADO, NEGATIVO, POSITIVO);

    private CitacaoStatus() {}

    public static void validar(String status) {
        if (status == null || status.isBlank()) {
            throw new BusinessRuleException("status é obrigatório.");
        }
        String norm = status.trim().toUpperCase();
        if (!VALIDOS.contains(norm)) {
            throw new BusinessRuleException(
                    "status inválido: " + status + ". Valores: " + String.join(", ", VALIDOS));
        }
    }

    public static String normalizar(String status) {
        validar(status);
        return status.trim().toUpperCase();
    }
}
