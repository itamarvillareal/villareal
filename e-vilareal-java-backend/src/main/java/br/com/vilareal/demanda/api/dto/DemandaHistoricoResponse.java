package br.com.vilareal.demanda.api.dto;

import java.time.Instant;

public record DemandaHistoricoResponse(
        Long id,
        String statusAnterior,
        String statusNovo,
        String descricaoAcao,
        Long usuarioId,
        Instant createdAt) {}
