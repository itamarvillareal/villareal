package br.com.vilareal.demanda.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record DemandaCriarPagamentoRequest(
        String categoria,
        BigDecimal valorOriginal,
        LocalDate dataVencimento,
        String codigoBarras,
        String observacao) {}
