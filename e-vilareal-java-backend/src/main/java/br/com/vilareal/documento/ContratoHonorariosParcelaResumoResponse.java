package br.com.vilareal.documento;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ContratoHonorariosParcelaResumoResponse(
        Long id,
        Integer numeroParcela,
        BigDecimal valor,
        LocalDate dataVencimento,
        Long pagamentoId) {}
