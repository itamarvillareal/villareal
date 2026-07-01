package br.com.vilareal.calculo.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.Set;

/** Valores permitidos para {@code regraInicioCobrancaDias} na config de cálculo do cliente. */
public final class RegraInicioCobrancaDiasValidator {

    /** Importa todas as unidades com taxas vencidas na planilha (D+1). */
    public static final int REGRA_IMPORTAR_TUDO = 1;
    /** 60+1 condicional: exige &gt;60 dias na planilha, salvo se já houver débito cadastrado &gt;60 dias. */
    public static final int REGRA_CONDICIONAL_60_MAIS_1 = 61;

    public static final int DEFAULT = REGRA_IMPORTAR_TUDO;
    private static final Set<Integer> PERMITIDOS = Set.of(REGRA_IMPORTAR_TUDO, REGRA_CONDICIONAL_60_MAIS_1);

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

    /** Aceita legado 30/60 migrando para a regra condicional 61. */
    public static int validar(int valor) {
        if (valor == 30 || valor == 60) {
            return REGRA_CONDICIONAL_60_MAIS_1;
        }
        if (!PERMITIDOS.contains(valor)) {
            throw invalido(String.valueOf(valor));
        }
        return valor;
    }

    public static String label(int regraDias) {
        int r = validar(regraDias);
        if (r == REGRA_CONDICIONAL_60_MAIS_1) {
            return "60+1 condicional";
        }
        return "Importar tudo";
    }

    private static BusinessRuleException invalido(String recebido) {
        return new BusinessRuleException(
                "regraInicioCobrancaDias deve ser 1 (importar tudo) ou 61 (60+1 condicional) (recebido: "
                        + recebido
                        + ").");
    }
}
