package br.com.vilareal.recebivel.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record RecebivelQuadroResponse(
        LocalDate periodoInicio,
        LocalDate periodoFim,
        BigDecimal totalGeral,
        BigDecimal totalVencido,
        List<RecebivelQuadroResumoTipoResponse> resumoPorTipo,
        List<RecebivelQuadroItemResponse> itens) {}
