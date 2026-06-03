package br.com.vilareal.condominio.application;

import java.util.List;

/** Resultado da leitura do .xls: cabeçalho do relatório + unidades. */
public record CobrancaRelatorioParseResult(
        List<CobrancaUnidadeParsed> unidades, String condominioNome, String dataReferencia) {}
