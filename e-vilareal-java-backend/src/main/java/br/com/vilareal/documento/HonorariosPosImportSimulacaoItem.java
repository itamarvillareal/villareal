package br.com.vilareal.documento;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record HonorariosPosImportSimulacaoItem(
        String resultado,
        Long lancamentoId,
        Integer numeroBanco,
        String bancoNome,
        LocalDate dataLancamento,
        BigDecimal valorLancamento,
        String descricaoLancamento,
        Long contratoId,
        Long processoId,
        Integer processoNumeroInterno,
        String honorarioNome,
        Integer numeroParcela,
        BigDecimal parcelaValor,
        LocalDate parcelaVencimento,
        int score,
        int segundoScore,
        int gapScore,
        int totalCandidatos) {}
