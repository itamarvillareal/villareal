package br.com.vilareal.documento.api.dto;

import java.math.BigDecimal;
import java.util.List;

public record RepassePendenteHonorarioCarteiraResponse(
        BigDecimal totalEmAberto, List<RepassePendenteHonorarioItemResponse> itens) {}
