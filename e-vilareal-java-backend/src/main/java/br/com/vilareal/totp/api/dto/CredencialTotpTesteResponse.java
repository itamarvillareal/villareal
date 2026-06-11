package br.com.vilareal.totp.api.dto;

/**
 * Resposta do endpoint de teste — código atual para conferência com o app autenticador.
 */
public record CredencialTotpTesteResponse(
        Long credencialId,
        String tribunal,
        String login,
        String codigoAtual,
        int periodoSegundos,
        int segundosRestantesNoPeriodo) {}
