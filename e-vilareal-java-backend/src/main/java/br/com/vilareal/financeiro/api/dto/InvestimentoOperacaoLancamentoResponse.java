package br.com.vilareal.financeiro.api.dto;

import br.com.vilareal.financeiro.domain.InvestimentoOperacaoLancamentoPapel;
import br.com.vilareal.financeiro.domain.NaturezaLancamento;

import java.math.BigDecimal;
import java.time.LocalDate;

public record InvestimentoOperacaoLancamentoResponse(
        Long lancamentoId,
        InvestimentoOperacaoLancamentoPapel papel,
        LocalDate dataLancamento,
        String descricao,
        BigDecimal valorExtrato,
        NaturezaLancamento natureza,
        BigDecimal valorAlocado) {}
