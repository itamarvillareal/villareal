package br.com.vilareal.agendamento.infrastructure.persistence.entity;

import br.com.vilareal.agendamento.domain.OrigemConsulta;
import br.com.vilareal.agendamento.domain.StatusExecucao;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "consulta_processo_execucao")
@Getter
@Setter
public class ConsultaProcessoExecucaoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "processo_id", nullable = false)
    private ProcessoEntity processo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agendamento_id")
    private AgendamentoConsultaEntity agendamento;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OrigemConsulta origem;

    @Column(name = "iniciada_em", nullable = false)
    private LocalDateTime iniciadaEm;

    @Column(name = "finalizada_em")
    private LocalDateTime finalizadaEm;

    @Column(name = "duracao_ms")
    private Long duracaoMs;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private StatusExecucao status;

    @Column(name = "teores_novos", nullable = false)
    private Integer teoresNovos = 0;

    @Column(name = "teores_ja_existentes", nullable = false)
    private Integer teoresJaExistentes = 0;

    @Column(name = "arquivos_baixados", nullable = false)
    private Integer arquivosBaixados = 0;

    @Column(columnDefinition = "TEXT")
    private String erro;

    @Column(columnDefinition = "TEXT")
    private String detalhes;

    @PrePersist
    protected void onCreate() {
        if (teoresNovos == null) {
            teoresNovos = 0;
        }
        if (teoresJaExistentes == null) {
            teoresJaExistentes = 0;
        }
        if (arquivosBaixados == null) {
            arquivosBaixados = 0;
        }
    }
}
