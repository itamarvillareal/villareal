package br.com.vilareal.topicos.api.dto;

import java.util.List;

/** Resultado da conversão em lote do conteúdo legado para HTML + tokens. */
public record TopicoConverterHtmlResponse(
        String filtro, int total, int convertidos, boolean dryRun, List<Amostra> amostra) {

    public record Amostra(String chaveNavegacao, Integer blocoIndice, String classe, String htmlInicio) {}
}
