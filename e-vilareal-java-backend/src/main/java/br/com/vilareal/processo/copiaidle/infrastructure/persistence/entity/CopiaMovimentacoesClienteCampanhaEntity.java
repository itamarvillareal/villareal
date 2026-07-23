package br.com.vilareal.processo.copiaidle.infrastructure.persistence.entity;

import br.com.vilareal.processo.copiaidle.domain.CopiaMovimentacoesCampanhaStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "copia_movimentacoes_cliente_campanha")
@Getter
@Setter
public class CopiaMovimentacoesClienteCampanhaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "codigo_cliente", nullable = false, columnDefinition = "CHAR(8)")
    private String codigoCliente;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private CopiaMovimentacoesCampanhaStatus status;

    @Column(name = "total_processos", nullable = false)
    private Integer totalProcessos = 0;

    @Column(nullable = false)
    private Integer completos = 0;

    @Column(nullable = false)
    private Integer erros = 0;

    @Column(nullable = false)
    private Integer ignorados = 0;

    @Column(name = "iniciada_em", nullable = false)
    private LocalDateTime iniciadaEm;

    @Column(name = "concluida_em")
    private LocalDateTime concluidaEm;

    @Column(name = "email_enviado_em")
    private LocalDateTime emailEnviadoEm;

    @Column(name = "atualizado_em", nullable = false)
    private LocalDateTime atualizadoEm;

    @PrePersist
    void onCreate() {
        LocalDateTime agora = LocalDateTime.now();
        if (iniciadaEm == null) {
            iniciadaEm = agora;
        }
        atualizadoEm = agora;
        if (totalProcessos == null) {
            totalProcessos = 0;
        }
        if (completos == null) {
            completos = 0;
        }
        if (erros == null) {
            erros = 0;
        }
        if (ignorados == null) {
            ignorados = 0;
        }
    }

    @PreUpdate
    void onUpdate() {
        atualizadoEm = LocalDateTime.now();
    }
}
