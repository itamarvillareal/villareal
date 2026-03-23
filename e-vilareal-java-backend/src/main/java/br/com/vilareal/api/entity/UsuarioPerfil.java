package br.com.vilareal.api.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "usuario_perfil", indexes = {
        @Index(name = "idx_usuario_perfil_perfil", columnList = "perfil_id")
})
public class UsuarioPerfil {
    @EmbeddedId
    private UsuarioPerfilId id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("usuarioId")
    @JoinColumn(name = "usuario_id", foreignKey = @ForeignKey(name = "fk_usuario_perfil_usuario"))
    private Usuario usuario;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("perfilId")
    @JoinColumn(name = "perfil_id", foreignKey = @ForeignKey(name = "fk_usuario_perfil_perfil"))
    private Perfil perfil;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public UsuarioPerfilId getId() { return id; }
    public void setId(UsuarioPerfilId id) { this.id = id; }
    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }
    public Perfil getPerfil() { return perfil; }
    public void setPerfil(Perfil perfil) { this.perfil = perfil; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
