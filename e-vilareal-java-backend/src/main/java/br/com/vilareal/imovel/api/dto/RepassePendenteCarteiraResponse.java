package br.com.vilareal.imovel.api.dto;

import java.math.BigDecimal;
import java.util.List;

/** Carteira de repasses pendentes/divergentes agregada a partir dos vínculos existentes. */
public record RepassePendenteCarteiraResponse(BigDecimal totalEmAberto, List<RepassePendenteItemResponse> itens) {}
