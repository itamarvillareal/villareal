package br.com.vilareal.configuracao.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.time.Instant;

@Entity
@Table(name = "usuario_menu_item")
@IdClass(UsuarioMenuItemEntity.Pk.class)
@Getter
@Setter
public class UsuarioMenuItemEntity {

    @Id
    @Column(name = "usuario_id", nullable = false)
    private Long usuarioId;

    @Id
    @Column(name = "modulo_id", nullable = false, length = 80)
    private String moduloId;

    @Column(nullable = false)
    private Boolean visivel = true;

    @Column(nullable = false)
    private Integer ordem = 0;

    @Column(name = "atualizado_em", insertable = false, updatable = false)
    private Instant atualizadoEm;

    @NoArgsConstructor
    @Getter
    @Setter
    @EqualsAndHashCode
    public static class Pk implements Serializable {
        private Long usuarioId;
        private String moduloId;

        public Pk(Long usuarioId, String moduloId) {
            this.usuarioId = usuarioId;
            this.moduloId = moduloId;
        }
    }
}
