package br.com.vilareal.financeiro.api.dto;

import java.math.BigDecimal;

public record InvestimentoResumoResponse(
        int operacoesFechadasComTaxa,
        int operacoesAbertas,
        BigDecimal medianaTaxaMensalLiquida,
        BigDecimal volumeAberto,
        long movimentacoesVinculadasExtrato) {}
