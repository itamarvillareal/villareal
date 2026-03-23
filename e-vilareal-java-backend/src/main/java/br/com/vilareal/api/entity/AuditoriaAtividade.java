package br.com.vilareal.api.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "auditoria_atividades", indexes = {
        @Index(name = "idx_aud_ocorrido_em", columnList = "ocorrido_em"),
        @Index(name = "idx_aud_usuario_id", columnList = "usuario_id"),
        @Index(name = "idx_aud_modulo", columnList = "modulo"),
        @Index(name = "idx_aud_tipo_acao", columnList = "tipo_acao")
})
public class AuditoriaAtividade {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "usuario_id", nullable = false, length = 64)
    private String usuarioId;

    @Column(name = "usuario_nome", nullable = false, length = 255)
    private String usuarioNome;

    @Column(name = "ocorrido_em", nullable = false)
    private Instant ocorridoEm;

    @Column(nullable = false, length = 128)
    private String modulo;

    @Column(length = 512)
    private String tela;

    @Column(name = "tipo_acao", nullable = false, length = 64)
    private String tipoAcao;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String descricao;

    @Column(name = "registro_afetado_id", length = 64)
    private String registroAfetadoId;

    @Column(name = "registro_afetado_nome", length = 512)
    private String registroAfetadoNome;

    @Column(name = "ip_origem", length = 64)
    private String ipOrigem;

    @Column(name = "observacoes_tecnicas", columnDefinition = "TEXT")
    private String observacoesTecnicas;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsuarioId() {
        return usuarioId;
    }

    public void setUsuarioId(String usuarioId) {
        this.usuarioId = usuarioId;
    }

    public String getUsuarioNome() {
        return usuarioNome;
    }

    public void setUsuarioNome(String usuarioNome) {
        this.usuarioNome = usuarioNome;
    }

    public Instant getOcorridoEm() {
        return ocorridoEm;
    }

    public void setOcorridoEm(Instant ocorridoEm) {
        this.ocorridoEm = ocorridoEm;
    }

    public String getModulo() {
        return modulo;
    }

    public void setModulo(String modulo) {
        this.modulo = modulo;
    }

    public String getTela() {
        return tela;
    }

    public void setTela(String tela) {
        this.tela = tela;
    }

    public String getTipoAcao() {
        return tipoAcao;
    }

    public void setTipoAcao(String tipoAcao) {
        this.tipoAcao = tipoAcao;
    }

    public String getDescricao() {
        return descricao;
    }

    public void setDescricao(String descricao) {
        this.descricao = descricao;
    }

    public String getRegistroAfetadoId() {
        return registroAfetadoId;
    }

    public void setRegistroAfetadoId(String registroAfetadoId) {
        this.registroAfetadoId = registroAfetadoId;
    }

    public String getRegistroAfetadoNome() {
        return registroAfetadoNome;
    }

    public void setRegistroAfetadoNome(String registroAfetadoNome) {
        this.registroAfetadoNome = registroAfetadoNome;
    }

    public String getIpOrigem() {
        return ipOrigem;
    }

    public void setIpOrigem(String ipOrigem) {
        this.ipOrigem = ipOrigem;
    }

    public String getObservacoesTecnicas() {
        return observacoesTecnicas;
    }

    public void setObservacoesTecnicas(String observacoesTecnicas) {
        this.observacoesTecnicas = observacoesTecnicas;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        AuditoriaAtividade that = (AuditoriaAtividade) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
