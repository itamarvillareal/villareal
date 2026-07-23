package br.com.vilareal.processo.copiaidle.infrastructure.persistence.entity;

import br.com.vilareal.processo.copiaidle.domain.CopiaMovimentacoesItemStatus;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "copia_movimentacoes_cliente_item")
@Getter
@Setter
public class CopiaMovimentacoesClienteItemEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "campanha_id", nullable = false)
    private CopiaMovimentacoesClienteCampanhaEntity campanha;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "processo_id", nullable = false)
    private ProcessoEntity processo;

    @Column(name = "numero_interno")
    private Integer numeroInterno;

    @Column(name = "numero_cnj", length = 40)
    private String numeroCnj;

    @Column(length = 80)
    private String tramitacao;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private CopiaMovimentacoesItemStatus status;

    @Column(name = "tem_mais")
    private Boolean temMais;

    @Column(nullable = false)
    private Integer tentativas = 0;

    @Column(name = "arquivos_baixados_total", nullable = false)
    private Integer arquivosBaixadosTotal = 0;

    @Column(name = "ultima_mensagem", columnDefinition = "TEXT")
    private String ultimaMensagem;

    @Column(name = "ultima_execucao_em")
    private LocalDateTime ultimaExecucaoEm;

    @Column(name = "concluido_em")
    private LocalDateTime concluidoEm;

    @Column(name = "criado_em", nullable = false)
    private LocalDateTime criadoEm;

    @Column(name = "atualizado_em", nullable = false)
    private LocalDateTime atualizadoEm;

    @PrePersist
    void onCreate() {
        LocalDateTime agora = LocalDateTime.now();
        if (criadoEm == null) {
            criadoEm = agora;
        }
        atualizadoEm = agora;
        if (tentativas == null) {
            tentativas = 0;
        }
        if (arquivosBaixadosTotal == null) {
            arquivosBaixadosTotal = 0;
        }
    }

    @PreUpdate
    void onUpdate() {
        atualizadoEm = LocalDateTime.now();
    }
}
