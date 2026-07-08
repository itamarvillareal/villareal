package br.com.vilareal.documento.importacao.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ExpectativaContingenteItemResponse(
        Long contratoId,
        Long processoId,
        String codigoCliente,
        Integer numeroInterno,
        String tipoRemuneracao,
        BigDecimal percentualProveito,
        BigDecimal expectativaValorEstimado,
        String expectativaBaseTipo,
        BigDecimal expectativaValorCausaRef,
        String expectativaObservacao,
        LocalDate dataContrato) {}
