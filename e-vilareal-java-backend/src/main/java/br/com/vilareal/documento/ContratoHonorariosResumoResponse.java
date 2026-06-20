package br.com.vilareal.documento;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ContratoHonorariosResumoResponse(
        Long id,
        Long processoId,
        Long pessoaId,
        LocalDate dataContrato,
        String tipoRemuneracao,
        BigDecimal percentualProveito,
        BigDecimal valorFixo,
        BigDecimal valorTotalParcelas,
        Integer quantidadeParcelas,
        Boolean gerarRecebiveis,
        int parcelasGeradas,
        String clausula3Texto) {}
