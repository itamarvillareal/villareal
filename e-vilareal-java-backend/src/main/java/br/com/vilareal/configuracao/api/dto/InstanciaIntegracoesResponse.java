package br.com.vilareal.configuracao.api.dto;

public record InstanciaIntegracoesResponse(
        String instanciaId,
        String instanciaRotulo,
        boolean projudiChaveConfigurada,
        boolean totpChaveConfigurada,
        String gmailConta,
        boolean gmailTokensConfigurados) {
}
