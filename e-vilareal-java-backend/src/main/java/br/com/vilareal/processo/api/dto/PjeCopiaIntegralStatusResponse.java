package br.com.vilareal.processo.api.dto;

import br.com.vilareal.pje.application.PjeCopiaIntegralStatusStore;

import java.time.Instant;

public record PjeCopiaIntegralStatusResponse(
        /** EM_ANDAMENTO, SUCESSO, FALHA ou NENHUM */
        String fase,
        String mensagem,
        Instant atualizadoEm,
        String driveFileId,
        String pastaMovimentacoesId) {

    public static PjeCopiaIntegralStatusResponse nenhum() {
        return new PjeCopiaIntegralStatusResponse("NENHUM", null, null, null, null);
    }

    public static PjeCopiaIntegralStatusResponse from(PjeCopiaIntegralStatusStore.Entrada entrada) {
        return new PjeCopiaIntegralStatusResponse(
                entrada.fase().name(),
                entrada.mensagem(),
                entrada.atualizadoEm(),
                entrada.driveFileId(),
                entrada.pastaMovimentacoesId());
    }
}
