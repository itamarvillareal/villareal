package br.com.vilareal.agendamento.infrastructure.persistence.entity;

import br.com.vilareal.agendamento.domain.PeriodoCadencia;
import br.com.vilareal.agendamento.domain.TipoCadencia;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "agendamento_consulta")
@Getter
@Setter
public class AgendamentoConsultaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "processo_id", nullable = false)
    private ProcessoEntity processo;

    @Column(nullable = false)
    private Boolean ativo = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_cadencia", nullable = false, length = 20)
    private TipoCadencia tipoCadencia;

    @Column(name = "intervalo_minutos")
    private Integer intervaloMinutos;

    @Column(name = "horarios_fixos", length = 255)
    private String horariosFixos;

    @Enumerated(EnumType.STRING)
    @Column(name = "periodo", length = 20)
    private PeriodoCadencia periodo;

    @Column(name = "periodo_horario")
    private LocalTime periodoHorario;

    @Column(name = "janela_inicio")
    private LocalTime janelaInicio;

    @Column(name = "janela_fim")
    private LocalTime janelaFim;

    @Column(name = "apenas_dias_uteis", nullable = false)
    private Boolean apenasDiasUteis = false;

    @Column(name = "considerar_feriados", nullable = false)
    private Boolean considerarFeriados = false;

    @Column(name = "proxima_execucao")
    private LocalDateTime proximaExecucao;

    @Column(name = "ultima_execucao")
    private LocalDateTime ultimaExecucao;

    @Column(name = "falhas_consecutivas", nullable = false)
    private Integer falhasConsecutivas = 0;

    @Column(name = "ultimo_erro", columnDefinition = "TEXT")
    private String ultimoErro;

    @Column(name = "ultima_falha_em")
    private LocalDateTime ultimaFalhaEm;

    @Column(name = "valido_ate")
    private LocalDateTime validoAte;

    @Column(nullable = false)
    private Integer prioridade = 0;

    @Column(length = 255)
    private String motivo;

    @Column(name = "criado_por", length = 100)
    private String criadoPor;

    @Column(name = "criado_em", nullable = false, insertable = false, updatable = false)
    private LocalDateTime criadoEm;

    @Column(name = "atualizado_em", insertable = false, updatable = false)
    private LocalDateTime atualizadoEm;

    @PrePersist
    protected void onCreate() {
        if (ativo == null) {
            ativo = true;
        }
        if (apenasDiasUteis == null) {
            apenasDiasUteis = false;
        }
        if (considerarFeriados == null) {
            considerarFeriados = false;
        }
        if (prioridade == null) {
            prioridade = 0;
        }
        if (falhasConsecutivas == null) {
            falhasConsecutivas = 0;
        }
    }
}
