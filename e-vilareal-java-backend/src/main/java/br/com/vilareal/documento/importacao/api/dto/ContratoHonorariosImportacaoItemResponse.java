package br.com.vilareal.documento.importacao.api.dto;

import java.math.BigDecimal;
import java.util.List;

public record ContratoHonorariosImportacaoItemResponse(
        Long importacaoId,
        String importacaoLoteId,
        String hashPdf,
        String pdfNomeArquivo,
        String codigoCliente,
        Long processoId,
        String status,
        String clausulaExtraidaTexto,
        ContratoHonorariosExtracaoDados dadosExtraidos,
        ContratoHonorariosExtracaoDados dadosAprovados,
        BigDecimal scoreConfianca,
        List<String> alertas,
        String roteamentoTipo,
        ProcessoMatchSugestaoResponse processoSugerido,
        boolean conflitoContratoExistente,
        Long contratoExistenteId,
        Long contratoHonorariosId,
        String conciliacaoJson) {}
