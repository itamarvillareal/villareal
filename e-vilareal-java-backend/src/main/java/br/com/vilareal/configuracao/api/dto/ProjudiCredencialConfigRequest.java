package br.com.vilareal.configuracao.api.dto;

import jakarta.validation.constraints.NotBlank;

public record ProjudiCredencialConfigRequest(
        @NotBlank String cpf,
        @NotBlank String senha,
        String rotulo) {
}
