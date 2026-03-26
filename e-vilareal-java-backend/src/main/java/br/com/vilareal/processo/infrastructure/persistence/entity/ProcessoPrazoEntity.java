package br.com.vilareal.processo.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "processo_prazo")
@Getter
@Setter
public class ProcessoPrazoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "processo_id", nullable = false)
    private ProcessoEntity processo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "andamento_id")
    private ProcessoAndamentoEntity andamento;

    @Column(length = 500)
    private String descricao;

    @Column(name = "data_inicio")
    private LocalDate dataInicio;

    @Column(name = "data_fim", nullable = false)
    private LocalDate dataFim;

    @Column(name = "prazo_fatal", nullable = false)
    private Boolean prazoFatal = false;

    @Column(length = 40)
    private String status;

    @Column(columnDefinition = "TEXT")
    private String observacao;
}
