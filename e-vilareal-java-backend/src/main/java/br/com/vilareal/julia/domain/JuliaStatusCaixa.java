package br.com.vilareal.julia.domain;

import br.com.vilareal.common.exception.BusinessRuleException;

public enum JuliaStatusCaixa {
    AGUARDANDO_VOCE,
    POSTERGADO,
    CONCLUIDO;

    public static JuliaStatusCaixa parse(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BusinessRuleException("statusCaixa é obrigatório.");
        }
        try {
            return JuliaStatusCaixa.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BusinessRuleException(
                    "statusCaixa inválido: " + raw + " (use AGUARDANDO_VOCE, POSTERGADO ou CONCLUIDO).");
        }
    }
}
