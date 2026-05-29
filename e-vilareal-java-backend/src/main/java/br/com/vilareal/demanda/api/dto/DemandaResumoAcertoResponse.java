package br.com.vilareal.demanda.api.dto;

import java.math.BigDecimal;
import java.util.List;

public record DemandaResumoAcertoResponse(
        Long imovelId,
        String imovelTitulo,
        Long clienteId,
        String clienteNome,
        BigDecimal totalDespesasEscritorio,
        BigDecimal totalReembolsado,
        BigDecimal saldoPendente,
        List<DemandaResponse> demandas) {}
