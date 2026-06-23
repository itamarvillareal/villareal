package br.com.vilareal.imovel.api.dto;

import br.com.vilareal.imovel.domain.StatusRepasse;

import java.math.BigDecimal;
import java.util.List;

/**
 * Resultado por imóvel/competência calculado SOMENTE a partir dos vínculos.
 * Quando consultado por período, {@code competencia} é nulo e {@code porCompetencia} traz o detalhe mês a mês.
 */
public record ReconciliacaoResultadoResponse(
        Long contratoId,
        String competencia,
        BigDecimal aluguelRecebido,
        BigDecimal repassado,
        BigDecimal despesas,
        BigDecimal resultadoEscritorio,
        BigDecimal taxaEfetivaPercent,
        BigDecimal taxaEsperadaPercent,
        StatusRepasse statusRepasse,
        /** {@code true} quando o locador é cliente próprio (repasse via conta virtual 900). */
        boolean repasseInterno,
        String locadorNome,
        String dadosBancariosRepasse,
        List<ReconciliacaoResultadoCompetenciaResponse> porCompetencia) {

    /** Detalhe de uma competência (ciclo). */
    public record ReconciliacaoResultadoCompetenciaResponse(
            String competencia,
            BigDecimal aluguelRecebido,
            BigDecimal repassado,
            BigDecimal despesas,
            BigDecimal resultadoEscritorio,
            BigDecimal taxaEfetivaPercent,
            BigDecimal taxaEsperadaPercent,
            StatusRepasse statusRepasse) {}
}
