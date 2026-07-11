package br.com.vilareal.imovel.api.dto;

import java.util.List;

/** Visão geral do portfólio de imóveis para uma competência (AAAA-MM). */
public record ImovelVisaoGeralResponse(String competencia, List<ImovelVisaoGeralItemResponse> itens) {}
