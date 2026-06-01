package br.com.vilareal.processo.api.dto;

/** Resultado do fetch progressivo PROJUDI → Drive (regra NOVAS_TOPO + BACKFILL). */
public record ProcessoProjudiMovimentacoesDriveResponse(
        int arquivosBaixados,
        int totalComDocumento,
        int totalArquivadasDrive,
        boolean temMais,
        String mensagem,
        String selecaoResumo,
        String erro) {}
