package br.com.vilareal.pagamento.infrastructure.persistence.entity;

import br.com.vilareal.pagamento.domain.PrestacaoContasStatus;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "prestacao_contas")
@Getter
@Setter
public class PrestacaoContasEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cliente_id", nullable = false)
    private ClienteEntity cliente;

    @Column(name = "periodo_inicio", nullable = false)
    private LocalDate periodoInicio;

    @Column(name = "periodo_fim", nullable = false)
    private LocalDate periodoFim;

    @Column(name = "valor_total_pagamentos", nullable = false, precision = 19, scale = 2)
    private BigDecimal valorTotalPagamentos = BigDecimal.ZERO;

    @Column(name = "taxa_administracao_percentual", precision = 5, scale = 2)
    private BigDecimal taxaAdministracaoPercentual;

    @Column(name = "taxa_administracao_valor", precision = 19, scale = 2)
    private BigDecimal taxaAdministracaoValor;

    @Column(name = "valor_liquido", nullable = false, precision = 19, scale = 2)
    private BigDecimal valorLiquido = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PrestacaoContasStatus status = PrestacaoContasStatus.RASCUNHO;

    @Column(name = "arquivo_pdf_path", length = 500)
    private String arquivoPdfPath;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "gerado_por_usuario_id", nullable = false)
    private UsuarioEntity geradoPorUsuario;

    @Column(columnDefinition = "TEXT")
    private String observacoes;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @Column(name = "atualizado_em", insertable = false, updatable = false)
    private Instant atualizadoEm;
}
