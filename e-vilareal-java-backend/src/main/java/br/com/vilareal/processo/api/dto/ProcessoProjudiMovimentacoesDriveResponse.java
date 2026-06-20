package br.com.vilareal.processo.api.dto;

import java.time.LocalDate;

/** Resultado do fetch progressivo PROJUDI → Drive (regra NOVAS_TOPO + BACKFILL). */
public record ProcessoProjudiMovimentacoesDriveResponse(
        int arquivosBaixados,
        int totalComDocumento,
        int totalArquivadasDrive,
        boolean temMais,
        String mensagem,
        String selecaoResumo,
        String erro,
        LocalDate dataProtocolo) {}
