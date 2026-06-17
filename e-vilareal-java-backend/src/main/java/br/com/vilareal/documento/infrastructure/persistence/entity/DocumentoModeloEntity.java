package br.com.vilareal.documento.infrastructure.persistence.entity;

import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "documento_modelo")
@Getter
@Setter
public class DocumentoModeloEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String label;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_responsavel_id", nullable = false, unique = true)
    private UsuarioEntity usuarioResponsavel;

    @Column(name = "advogado_nome", nullable = false, length = 255)
    private String advogadoNome;

    @Column(name = "advogado_oab", nullable = false, length = 80)
    private String advogadoOab;

    @Column(name = "rodape_texto", nullable = false, columnDefinition = "TEXT")
    private String rodapeTexto;

    @Lob
    @Column(name = "cabecalho_imagem", columnDefinition = "LONGBLOB")
    private byte[] cabecalhoImagem;

    @Column(name = "cabecalho_content_type", length = 100)
    private String cabecalhoContentType;

    @Column(nullable = false)
    private Boolean ativo = true;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @Column(name = "atualizado_em", insertable = false, updatable = false)
    private Instant atualizadoEm;

    @PrePersist
    protected void onCreate() {
        if (ativo == null) {
            ativo = true;
        }
    }
}
