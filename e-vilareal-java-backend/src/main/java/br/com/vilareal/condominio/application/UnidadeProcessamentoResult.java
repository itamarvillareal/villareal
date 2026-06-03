package br.com.vilareal.condominio.application;

import br.com.vilareal.calculo.application.ResultadoMerge;
import br.com.vilareal.condominio.api.dto.CobrancaUnidadeRequestDto;

/** Resultado interno do processamento de uma unidade (resolver + merge + andamento). */
record UnidadeProcessamentoResult(
        CobrancaUnidadeRequestDto unidade, ResolucaoUnidade resolucao, ResultadoMerge merge) {}
