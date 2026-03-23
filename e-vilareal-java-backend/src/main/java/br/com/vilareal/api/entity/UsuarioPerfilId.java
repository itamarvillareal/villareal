package br.com.vilareal.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class UsuarioPerfilId implements Serializable {
    @Column(name = "usuario_id")
    private Long usuarioId;

    @Column(name = "perfil_id")
    private Long perfilId;

    public UsuarioPerfilId() {}

    public UsuarioPerfilId(Long usuarioId, Long perfilId) {
        this.usuarioId = usuarioId;
        this.perfilId = perfilId;
    }

    public Long getUsuarioId() { return usuarioId; }
    public void setUsuarioId(Long usuarioId) { this.usuarioId = usuarioId; }
    public Long getPerfilId() { return perfilId; }
    public void setPerfilId(Long perfilId) { this.perfilId = perfilId; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof UsuarioPerfilId that)) return false;
        return Objects.equals(usuarioId, that.usuarioId) && Objects.equals(perfilId, that.perfilId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(usuarioId, perfilId);
    }
}
