package br.com.vilareal.projudi.api.dto;

import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiCredencialEntity;

import java.time.Instant;

/**
 * Resposta pública de uma credencial PROJUDI.
 *
 * <p><b>Segurança:</b> NUNCA contém a senha (nem em claro nem cifrada) nem o IV.
 * Apenas metadados não sensíveis.</p>
 */
public record ProjudiCredencialResponse(
        Long id,
        Long usuarioId,
        String cpfUsuario,
        String rotulo,
        boolean ativo,
        Instant createdAt,
        Instant updatedAt) {

    public static ProjudiCredencialResponse de(ProjudiCredencialEntity e) {
        return new ProjudiCredencialResponse(
                e.getId(),
                e.getUsuarioId(),
                e.getCpfUsuario(),
                e.getRotulo(),
                e.isAtivo(),
                e.getCreatedAt(),
                e.getUpdatedAt());
    }
}
