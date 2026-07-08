package br.com.vilareal.configuracao.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Código TOTP atual do login PDPJ/PJe TRT18 (app autenticador). */
public record PdpjCodigoResponse(
        @Schema(description = "Código numérico do período vigente (geralmente 6 dígitos)") String codigo,
        @Schema(description = "Quantidade de dígitos configurada na credencial") int digitos,
        @Schema(description = "Duração do período TOTP em segundos (ex.: 30)") int periodoSegundos,
        @Schema(description = "Segundos até o código mudar") int segundosRestantes,
        @Schema(description = "Login PDPJ associado (mascarado parcialmente)") String loginMascarado) {}
