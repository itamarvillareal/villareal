package br.com.vilareal.api.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "perfil_permissao", indexes = {
        @Index(name = "idx_perfil_permissao_permissao", columnList = "permissao_id")
})
public class PerfilPermissao {
    @EmbeddedId
    private PerfilPermissaoId id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("perfilId")
    @JoinColumn(name = "perfil_id", foreignKey = @ForeignKey(name = "fk_perfil_permissao_perfil"))
    private Perfil perfil;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("permissaoId")
    @JoinColumn(name = "permissao_id", foreignKey = @ForeignKey(name = "fk_perfil_permissao_permissao"))
    private Permissao permissao;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public PerfilPermissaoId getId() { return id; }
    public void setId(PerfilPermissaoId id) { this.id = id; }
    public Perfil getPerfil() { return perfil; }
    public void setPerfil(Perfil perfil) { this.perfil = perfil; }
    public Permissao getPermissao() { return permissao; }
    public void setPermissao(Permissao permissao) { this.permissao = permissao; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
