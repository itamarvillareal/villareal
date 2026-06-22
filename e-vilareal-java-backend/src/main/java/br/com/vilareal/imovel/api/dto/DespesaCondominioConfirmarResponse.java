package br.com.vilareal.imovel.api.dto;

import java.math.BigDecimal;

public record DespesaCondominioConfirmarResponse(
        Long imovelId,
        Integer imovelNumeroPlanilha,
        String responsavelPagamentoCondominio,
        Long recorrenciaConfigId,
        boolean recorrenciaCriadaAgora,
        boolean idempotente,
        BigDecimal valorEstimado,
        int diaVencimento,
        String descricaoPadrao) {}
