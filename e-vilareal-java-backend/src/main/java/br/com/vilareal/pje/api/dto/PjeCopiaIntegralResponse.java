package br.com.vilareal.pje.api.dto;

import br.com.vilareal.pje.application.PjeCopiaIntegralResult;

public record PjeCopiaIntegralResponse(
        String grau,
        String numeroCnj,
        boolean sucesso,
        String driveFileId,
        String nomeArquivo,
        String mensagem) {

    public static PjeCopiaIntegralResponse from(PjeCopiaIntegralResult resultado) {
        return new PjeCopiaIntegralResponse(
                resultado.grau() != null ? resultado.grau().name() : null,
                resultado.numeroCnj(),
                resultado.sucesso(),
                resultado.driveFileId(),
                resultado.nomeArquivo(),
                resultado.mensagem());
    }
}
