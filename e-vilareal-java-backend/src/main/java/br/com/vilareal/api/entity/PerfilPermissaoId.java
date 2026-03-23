package br.com.vilareal.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class PerfilPermissaoId implements Serializable {
    @Column(name = "perfil_id")
    private Long perfilId;

    @Column(name = "permissao_id")
    private Long permissaoId;

    public PerfilPermissaoId() {}

    public PerfilPermissaoId(Long perfilId, Long permissaoId) {
        this.perfilId = perfilId;
        this.permissaoId = permissaoId;
    }

    public Long getPerfilId() { return perfilId; }
    public void setPerfilId(Long perfilId) { this.perfilId = perfilId; }
    public Long getPermissaoId() { return permissaoId; }
    public void setPermissaoId(Long permissaoId) { this.permissaoId = permissaoId; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof PerfilPermissaoId that)) return false;
        return Objects.equals(perfilId, that.perfilId) && Objects.equals(permissaoId, that.permissaoId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(perfilId, permissaoId);
    }
}
