package br.com.vilareal.imovel.api.dto;

import java.util.List;

public record RelatorioFinanceiroImoveisResponse(String competencia, List<RelatorioFinanceiroImovelLinhaResponse> linhas) {}
