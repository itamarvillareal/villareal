package br.com.vilareal.documento.importacao.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record ContratoHonorariosConciliacaoRetroativaResponse(
        Long importacaoId,
        LocalDate periodoDe,
        LocalDate periodoAte,
        boolean extratoCoberto,
        int totalParcelasGeradas,
        int parcelasQuitadas,
        BigDecimal valorQuitadas,
        int parcelasParaRevisar,
        List<ConciliacaoSugestaoItem> sugestoesPendentes,
        int parcelasPassivo,
        BigDecimal valorPassivo,
        List<String> avisosExtrato) {}
