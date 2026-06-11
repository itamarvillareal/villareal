package br.com.vilareal.pje.api.dto;

import br.com.vilareal.pje.application.PjeLoginResult;

public record PjeLoginResultResponse(
        String tribunal,
        String grau,
        String login,
        boolean sucesso,
        String estadoFinal,
        String mensagem,
        boolean modoLeitura) {

    public static PjeLoginResultResponse from(PjeLoginResult resultado, boolean modoLeitura) {
        return new PjeLoginResultResponse(
                resultado.tribunal().name(),
                resultado.grau() != null ? resultado.grau().name() : null,
                resultado.login(),
                resultado.sucesso(),
                resultado.estadoFinal() != null ? resultado.estadoFinal().name() : null,
                resultado.mensagem(),
                modoLeitura);
    }
}
