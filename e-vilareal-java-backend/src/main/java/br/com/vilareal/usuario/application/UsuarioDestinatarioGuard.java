package br.com.vilareal.usuario.application;

import br.com.vilareal.common.exception.InvalidAssigneeException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import br.com.vilareal.usuario.model.TipoUsuario;
import org.springframework.stereotype.Component;

/** Valida que usuários ASSISTENTE_IA não sejam usados como dono/destinatário/assignee. */
@Component
public class UsuarioDestinatarioGuard {

    public static final String MENSAGEM_ASSISTENTE_DESTINATARIO =
            "Assistente de IA não pode ser responsável/destinatário";

    private final UsuarioRepository usuarioRepository;

    public UsuarioDestinatarioGuard(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    public void exigirHumanoDestinatario(UsuarioEntity usuario) {
        if (usuario != null && usuario.getTipo() == TipoUsuario.ASSISTENTE_IA) {
            throw new InvalidAssigneeException(MENSAGEM_ASSISTENTE_DESTINATARIO);
        }
    }

    public UsuarioEntity carregarHumanoDestinatario(Long usuarioId) {
        if (usuarioId == null) {
            return null;
        }
        UsuarioEntity u = usuarioRepository
                .findById(usuarioId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado: " + usuarioId));
        exigirHumanoDestinatario(u);
        return u;
    }
}
