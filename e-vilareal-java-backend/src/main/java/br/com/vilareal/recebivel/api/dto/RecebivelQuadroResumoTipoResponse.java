package br.com.vilareal.recebivel.api.dto;

import br.com.vilareal.recebivel.domain.RecebivelQuadroTipo;

import java.math.BigDecimal;

public record RecebivelQuadroResumoTipoResponse(
        RecebivelQuadroTipo tipo,
        int quantidade,
        BigDecimal total,
        BigDecimal totalVencido) {}
