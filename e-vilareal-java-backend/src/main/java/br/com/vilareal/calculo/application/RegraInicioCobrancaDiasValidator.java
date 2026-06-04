package br.com.vilareal.calculo.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.Set;

/** Valores permitidos para {@code regraInicioCobrancaDias} na config de cálculo do cliente. */
public final class RegraInicioCobrancaDiasValidator {

    public static final int DEFAULT = 1;
    private static final Set<Integer> PERMITIDOS = Set.of(1, 30, 60);

    private RegraInicioCobrancaDiasValidator() {}

    public static int parse(JsonNode node) {
        if (node == null || node.isNull()) {
            return DEFAULT;
        }
        int valor;
        if (node.isInt() || node.isLong()) {
            valor = node.intValue();
        } else if (node.isTextual()) {
            try {
                valor = Integer.parseInt(node.asText().trim());
            } catch (NumberFormatException e) {
                throw invalido(node.asText());
            }
        } else {
            throw invalido(node.toString());
        }
        return validar(valor);
    }

    public static int validar(int valor) {
        if (!PERMITIDOS.contains(valor)) {
            throw invalido(String.valueOf(valor));
        }
        return valor;
    }

    private static BusinessRuleException invalido(String recebido) {
        return new BusinessRuleException(
                "regraInicioCobrancaDias deve ser 1, 30 ou 60 (recebido: " + recebido + ").");
    }
}
