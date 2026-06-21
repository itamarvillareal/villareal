package br.com.vilareal.documento;

public record ContratoHonorariosAprovarSugestaoResponse(
        Long pagamentoId,
        String pagamentoStatus,
        Long financeiroLancamentoId,
        String mensagem) {}
