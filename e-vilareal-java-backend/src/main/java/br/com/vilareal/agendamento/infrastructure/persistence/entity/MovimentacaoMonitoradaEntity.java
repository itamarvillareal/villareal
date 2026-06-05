package br.com.vilareal.agendamento.infrastructure.persistence.entity;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "movimentacao_monitorada",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_movimonitorada_proc_movi",
                        columnNames = {"processo_id", "id_movi"}))
@Getter
@Setter
public class MovimentacaoMonitoradaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "processo_id", nullable = false)
    private ProcessoEntity processo;

    @Column(name = "id_movi", nullable = false, length = 64)
    private String idMovi;

    @Column(name = "numero")
    private Integer numero;

    @Column(name = "legenda", length = 1000)
    private String legenda;

    @Column(name = "data_movimentacao")
    private LocalDateTime dataMovimentacao;

    @Column(name = "data_consulta", nullable = false)
    private LocalDateTime dataConsulta;

    @Column(name = "criado_em", nullable = false, insertable = false, updatable = false)
    private LocalDateTime criadoEm;
}
