package br.com.vilareal.pje.api.dto;

import br.com.vilareal.pje.domain.PjeGrau;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record PjeCopiaIntegralRequest(
        @NotNull PjeGrau grau,
        @NotBlank String login,
        /** Opcional — se omitida, usa senha cifrada do cofre TOTP. */
        String senha,
        @NotBlank String numeroCnj) {}
