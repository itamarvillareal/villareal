package br.com.vilareal.documento.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Crédito candidato a alvará (read-only, sem vínculo). */
public record CandidatoAlvaraCreditoResponse(
        Long lancamentoId,
        LocalDate data,
        BigDecimal valor,
        String descricao,
        BigDecimal percentualProveito,
        BigDecimal retencao,
        BigDecimal repasseEsperado) {}
