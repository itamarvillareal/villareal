package br.com.vilareal.totp.api.dto;

import jakarta.validation.constraints.NotBlank;

/** Corpo para definir apenas a senha do 1º fator de uma credencial TOTP existente. */
public record CredencialTotpSenhaRequest(@NotBlank String senha) {}
