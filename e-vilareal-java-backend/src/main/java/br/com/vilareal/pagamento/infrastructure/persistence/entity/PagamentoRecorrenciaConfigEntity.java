package br.com.vilareal.pagamento.infrastructure.persistence.entity;

import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "pagamento_recorrencia_config")
@Getter
@Setter
public class PagamentoRecorrenciaConfigEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "imovel_id", nullable = false)
    private ImovelEntity imovel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cliente_id")
    private ClienteEntity cliente;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contrato_locacao_id")
    private ContratoLocacaoEntity contratoLocacao;

    @Column(nullable = false, length = 40)
    private String categoria;

    @Column(name = "descricao_padrao", nullable = false, length = 500)
    private String descricaoPadrao;

    @Column(name = "grafias_extrato_json", columnDefinition = "TEXT")
    private String grafiasExtratoJson;

    @Column(name = "conta_referencia", length = 50)
    private String contaReferencia;

    @Column(name = "dia_vencimento", nullable = false, columnDefinition = "TINYINT")
    private Integer diaVencimento;

    @Column(name = "valor_estimado", precision = 19, scale = 2)
    private BigDecimal valorEstimado;

    @Column(name = "forma_pagamento", nullable = false, length = 40)
    private String formaPagamento;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "responsavel_usuario_id")
    private UsuarioEntity responsavelUsuario;

    @Column(nullable = false, length = 24)
    private String prioridade = "NORMAL";

    @Column(nullable = false)
    private Boolean ativo = true;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "criado_por_usuario_id", nullable = false)
    private UsuarioEntity criadoPorUsuario;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @Column(name = "atualizado_em", insertable = false, updatable = false)
    private Instant atualizadoEm;
}
