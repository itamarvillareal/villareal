package br.com.vilareal.documento.api.dto;

import java.math.BigDecimal;
import java.util.List;

/** Processo com contrato percentual e créditos candidatos a alvará. */
public record CandidatoAlvaraProcessoResponse(
        Long contratoHonorariosId,
        Long processoId,
        String codigoCliente,
        Integer numeroInterno,
        String contratanteNome,
        BigDecimal percentualProveito,
        List<CandidatoAlvaraCreditoResponse> candidatos) {}
