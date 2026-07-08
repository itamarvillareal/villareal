package br.com.vilareal.documento.importacao.api.dto;

public record ProcessoMatchSugestaoResponse(
        Long processoId,
        Integer numeroInterno,
        String numeroCnj,
        String descricao,
        int scoreMatch,
        boolean stubNecessario) {}
