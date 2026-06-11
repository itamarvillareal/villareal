package br.com.vilareal.totp.api.dto;

import br.com.vilareal.totp.domain.TipoSegundoFator;
import br.com.vilareal.totp.infrastructure.persistence.entity.CredencialTotpEntity;

import java.time.Instant;

/**
 * Metadados da credencial TOTP — nunca inclui o secret.
 */
public record CredencialTotpResponse(
        Long id,
        String tribunal,
        TipoSegundoFator tipoSegundoFator,
        String login,
        String algoritmo,
        int digitos,
        int periodoSegundos,
        String issuer,
        String accountName,
        boolean ativo,
        /** Indica se há senha do 1º fator no cofre (sem expor o valor). */
        boolean senhaCadastrada,
        Instant criadoEm,
        Instant atualizadoEm) {

    public static CredencialTotpResponse from(CredencialTotpEntity entity) {
        return new CredencialTotpResponse(
                entity.getId(),
                entity.getTribunal().name(),
                entity.getTribunal().tipoSegundoFator(),
                entity.getLogin(),
                entity.getAlgoritmo().name(),
                entity.getDigitos(),
                entity.getPeriodoSegundos(),
                entity.getIssuer(),
                entity.getAccountName(),
                entity.isAtivo(),
                entity.getSenhaCriptografada() != null && !entity.getSenhaCriptografada().isBlank(),
                entity.getCreatedAt(),
                entity.getUpdatedAt());
    }
}
