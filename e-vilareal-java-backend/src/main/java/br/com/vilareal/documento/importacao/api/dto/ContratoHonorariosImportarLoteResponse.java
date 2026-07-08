package br.com.vilareal.documento.importacao.api.dto;

import java.util.List;

public record ContratoHonorariosImportarLoteResponse(
        String importacaoLoteId,
        int totalEnfileirados,
        int totalLimiteExcedido,
        List<ContratoHonorariosImportacaoItemResponse> itens) {}
