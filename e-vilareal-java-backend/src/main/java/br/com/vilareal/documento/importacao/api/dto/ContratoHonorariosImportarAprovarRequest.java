package br.com.vilareal.documento.importacao.api.dto;

import br.com.vilareal.documento.importacao.ContratoHonorariosImportacaoRoteamento;

import java.math.BigDecimal;

public record ContratoHonorariosImportarAprovarRequest(
        ContratoHonorariosImportacaoRoteamento roteamentoTipo,
        Long processoId,
        ProcessoStubConfirmacao processoStub,
        ContratoHonorariosExtracaoDados dadosAprovados,
        boolean forcarAtualizacao,
        BigDecimal expectativaValorEstimado,
        String expectativaBaseTipo,
        BigDecimal expectativaValorCausaRef) {}
