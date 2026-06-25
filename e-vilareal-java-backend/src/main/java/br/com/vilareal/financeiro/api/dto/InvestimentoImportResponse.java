package br.com.vilareal.financeiro.api.dto;

import java.time.Instant;
import java.time.LocalDate;

public record InvestimentoImportResponse(
        Long id,
        Long contaBancariaId,
        Integer numeroBanco,
        String bancoNome,
        String arquivoNome,
        LocalDate periodoInicio,
        LocalDate periodoFim,
        Integer totalLinhas,
        Integer linhasCdb,
        Integer linhasVinculadas,
        String status,
        Instant importadoEm) {}
