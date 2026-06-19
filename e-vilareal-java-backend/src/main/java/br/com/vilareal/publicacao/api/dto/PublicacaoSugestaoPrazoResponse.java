package br.com.vilareal.publicacao.api.dto;

import br.com.vilareal.publicacao.application.PrazoSugestaoOrigem;

import java.time.LocalDate;

public record PublicacaoSugestaoPrazoResponse(
        boolean identificado,
        PrazoSugestaoOrigem origem,
        int dias,
        LocalDate dataBase,
        LocalDate dataFatal,
        String explicacao,
        JuliaTriagemDicaResponse dicaJulia) {}
