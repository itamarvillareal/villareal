package br.com.vilareal.citacao.infrastructure.persistence.entity;

import br.com.vilareal.agendamento.infrastructure.persistence.entity.MovimentacaoMonitoradaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEnderecoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoAndamentoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "citacao_tentativa")
@Getter
@Setter
public class CitacaoTentativaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "processo_parte_id", nullable = false)
    private ProcessoParteEntity processoParte;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pessoa_endereco_id", nullable = false)
    private PessoaEnderecoEntity pessoaEndereco;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "data_solicitacao")
    private LocalDate dataSolicitacao;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "andamento_solicitacao_id")
    private ProcessoAndamentoEntity andamentoSolicitacao;

    @Column(name = "mov_projudi_solicitacao", length = 20)
    private String movProjudiSolicitacao;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mov_monitorada_solicitacao_id")
    private MovimentacaoMonitoradaEntity movMonitoradaSolicitacao;

    @Column(name = "data_retorno")
    private LocalDate dataRetorno;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "andamento_retorno_id")
    private ProcessoAndamentoEntity andamentoRetorno;

    @Column(name = "mov_projudi_retorno", length = 20)
    private String movProjudiRetorno;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mov_monitorada_retorno_id")
    private MovimentacaoMonitoradaEntity movMonitoradaRetorno;

    @Column(name = "motivo_retorno", columnDefinition = "TEXT")
    private String motivoRetorno;

    @Column(columnDefinition = "TEXT")
    private String observacao;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id")
    private UsuarioEntity usuario;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @Column(name = "atualizado_em", insertable = false, updatable = false)
    private Instant atualizadoEm;
}
