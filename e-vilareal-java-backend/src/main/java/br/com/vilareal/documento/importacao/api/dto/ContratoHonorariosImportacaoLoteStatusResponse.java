package br.com.vilareal.documento.importacao.api.dto;

public record ContratoHonorariosImportacaoLoteStatusResponse(
        String importacaoLoteId,
        int total,
        int extraidos,
        int emRevisao,
        int aprovados,
        int rejeitados,
        int revertidos,
        int pendentes,
        int erros) {}
