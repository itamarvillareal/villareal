package br.com.vilareal.financeiro.api.dto;

import br.com.vilareal.financeiro.domain.InvestimentoOperacaoStatus;
import br.com.vilareal.financeiro.domain.InvestimentoVinculoConfianca;

import java.math.BigDecimal;
import java.time.LocalDate;

public record InvestimentoOperacaoResponse(
        Long id,
        Integer numeroBanco,
        String bancoNome,
        String codigoProduto,
        String tipoProduto,
        String emissor,
        InvestimentoOperacaoStatus status,
        LocalDate dataCompra,
        LocalDate dataVenda,
        BigDecimal valorCompraCaixa,
        BigDecimal valorVendaCaixa,
        BigDecimal valorIrrf,
        BigDecimal valorIof,
        BigDecimal valorCustos,
        BigDecimal valorLiquidoEntrada,
        BigDecimal lucroLiquido,
        Integer diasCarteira,
        BigDecimal taxaMensalLiquida,
        BigDecimal taxaAnualLiquida,
        InvestimentoVinculoConfianca vinculoConfianca,
        Long compraLancamentoId,
        Long vendaLancamentoId) {}
