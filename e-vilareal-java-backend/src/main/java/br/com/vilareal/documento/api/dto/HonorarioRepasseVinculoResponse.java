package br.com.vilareal.documento.api.dto;

import br.com.vilareal.documento.domain.PapelHonorarioRepasse;

import java.math.BigDecimal;
import java.time.LocalDate;

public record HonorarioRepasseVinculoResponse(
        Long vinculoId,
        Long contratoHonorariosId,
        Long processoId,
        Long lancamentoFinanceiroId,
        PapelHonorarioRepasse papel,
        LocalDate dataReferencia,
        BigDecimal valor,
        Long alvaraVinculoId,
        /** Preenchido quando papel=ALVARA e contrato PERCENTUAL_PROVEITO. */
        BigDecimal percentualProveito,
        BigDecimal retencao,
        BigDecimal repasseEsperado) {}
