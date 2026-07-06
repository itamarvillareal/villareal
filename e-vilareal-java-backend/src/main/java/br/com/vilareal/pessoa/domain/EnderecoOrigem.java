package br.com.vilareal.pessoa.domain;

import br.com.vilareal.common.exception.BusinessRuleException;

import java.util.Set;

public final class EnderecoOrigem {

    public static final String SISBAJUD = "SISBAJUD";
    public static final String INFOJUD = "INFOJUD";
    public static final String RENAJUD = "RENAJUD";
    public static final String SIEL = "SIEL";
    public static final String INFORMADO_CLIENTE = "INFORMADO_CLIENTE";
    public static final String DOS_AUTOS = "DOS_AUTOS";
    public static final String MANUAL = "MANUAL";
    public static final String OUTRO = "OUTRO";

    private static final Set<String> VALIDOS = Set.of(
            SISBAJUD, INFOJUD, RENAJUD, SIEL, INFORMADO_CLIENTE, DOS_AUTOS, MANUAL, OUTRO);

    private EnderecoOrigem() {}

    public static void validar(String origem) {
        if (origem == null || origem.isBlank()) {
            throw new BusinessRuleException("origem é obrigatória.");
        }
        String norm = origem.trim().toUpperCase();
        if (!VALIDOS.contains(norm)) {
            throw new BusinessRuleException(
                    "origem inválida: " + origem + ". Valores: " + String.join(", ", VALIDOS));
        }
    }

    public static String normalizar(String origem) {
        validar(origem);
        return origem.trim().toUpperCase();
    }
}
