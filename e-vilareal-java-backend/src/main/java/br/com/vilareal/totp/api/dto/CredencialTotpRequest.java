package br.com.vilareal.totp.api.dto;

import jakarta.validation.constraints.NotBlank;

public record CredencialTotpRequest(
        @NotBlank String tribunal,
        @NotBlank String login,
        /** otpauth://totp/... ou secret Base32 cru. */
        @NotBlank String otpauthUriOuSecret,
        /** Senha do 1º fator (PJe); opcional — nunca retornada pela API. */
        String senha,
        Boolean ativo) {}
