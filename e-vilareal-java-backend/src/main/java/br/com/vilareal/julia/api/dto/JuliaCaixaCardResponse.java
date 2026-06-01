package br.com.vilareal.julia.api.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record JuliaCaixaCardResponse(
        Long triagemId,
        Long publicacaoId,
        Long processoId,
        String numeroCnj,
        String cliente,
        String parteAutora,
        String parteOposta,
        String classificacao,
        String impactoCliente,
        String prioridade,
        BigDecimal confianca,
        String resumo,
        String providenciaCliente,
        String acaoSugerida,
        String statusCaixa,
        String categoria,
        LocalDate postergarAte,
        Instant criadoEm,
        LocalDate prazoDataFim,
        Boolean prazoVencido) {}
