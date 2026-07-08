package br.com.vilareal.documento.importacao.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record ConciliacaoSugestaoItem(
        Integer numeroParcela,
        BigDecimal valorParcela,
        LocalDate dataVencimento,
        Long lancamentoId,
        BigDecimal valorLancamento,
        LocalDate dataLancamento,
        int score,
        String motivo) {}
