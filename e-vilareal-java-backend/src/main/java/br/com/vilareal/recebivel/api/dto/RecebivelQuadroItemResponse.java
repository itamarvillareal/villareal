package br.com.vilareal.recebivel.api.dto;

import br.com.vilareal.recebivel.domain.RecebivelQuadroStatus;
import br.com.vilareal.recebivel.domain.RecebivelQuadroTipo;

import java.math.BigDecimal;
import java.time.LocalDate;

public record RecebivelQuadroItemResponse(
        String descricao,
        RecebivelQuadroTipo tipo,
        LocalDate vencimento,
        BigDecimal valor,
        RecebivelQuadroStatus status,
        String origem,
        Long refId) {}
