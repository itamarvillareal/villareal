package br.com.vilareal.imovel.api.dto;

import br.com.vilareal.financeiro.domain.ConfiancaSugestao;
import br.com.vilareal.imovel.domain.StatusRepasse;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Visão mês a mês para classificar aluguéis: vínculo existente ou candidatos a confirmar.
 */
public record MatrizCompetenciasResponse(
        Long contratoId,
        BigDecimal valorAluguelContrato,
        Integer diaVencimentoAluguel,
        boolean repasseInterno,
        String competenciaInicio,
        String competenciaFim,
        List<MatrizCompetenciaItemResponse> meses) {

    public record MatrizCompetenciaItemResponse(
            String competencia,
            /** VINCULADO | CANDIDATO_UNICO | CANDIDATOS_MULTIPLOS | SEM_CANDIDATO */
            String estado,
            MatrizCompetenciaAluguelVinculadoResponse aluguelVinculado,
            List<MatrizCompetenciaCandidatoResponse> candidatos,
            BigDecimal aluguelRecebido,
            StatusRepasse statusRepasse) {}

    public record MatrizCompetenciaAluguelVinculadoResponse(
            Long vinculoId,
            Long lancamentoFinanceiroId,
            LocalDate data,
            String descricao,
            BigDecimal valor,
            Instant conferidoEm) {}

    public record MatrizCompetenciaCandidatoResponse(
            Long lancamentoFinanceiroId,
            LocalDate data,
            String descricao,
            BigDecimal valor,
            ConfiancaSugestao confianca,
            /** PROCESSO | ORFAO */
            String origem,
            boolean classificaAoConfirmar) {}
}
