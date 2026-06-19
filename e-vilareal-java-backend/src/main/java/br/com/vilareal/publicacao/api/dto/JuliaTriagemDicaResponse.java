package br.com.vilareal.publicacao.api.dto;

public record JuliaTriagemDicaResponse(
        String classificacao,
        String resumo,
        Boolean prazoExiste,
        String prazoNatureza,
        String prazoTipo,
        String prazoGatilho,
        Integer prazoDiasUteis,
        String prazoDataReal,
        String prazoDataTrabalho,
        String providenciaCliente,
        String acaoSugerida) {}
