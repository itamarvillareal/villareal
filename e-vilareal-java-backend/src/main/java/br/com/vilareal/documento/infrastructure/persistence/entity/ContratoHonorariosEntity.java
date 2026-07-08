package br.com.vilareal.documento.infrastructure.persistence.entity;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "contrato_honorarios")
@Getter
@Setter
public class ContratoHonorariosEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processo_id")
    private ProcessoEntity processo;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pessoa_id", nullable = false)
    private PessoaEntity pessoa;

    @Column(name = "data_contrato", nullable = false)
    private LocalDate dataContrato;

    @Column(name = "forma_assinatura", nullable = false, length = 20)
    private String formaAssinatura;

    @Column(name = "objeto_contrato", columnDefinition = "TEXT")
    private String objetoContrato;

    @Column(name = "tipo_remuneracao", nullable = false, length = 30)
    private String tipoRemuneracao;

    @Column(name = "percentual_proveito", precision = 5, scale = 2)
    private BigDecimal percentualProveito;

    @Column(name = "valor_fixo", precision = 19, scale = 2)
    private BigDecimal valorFixo;

    @Column(name = "clausula3_texto", nullable = false, columnDefinition = "TEXT")
    private String clausula3Texto;

    @Column(name = "gerar_recebiveis", nullable = false)
    private Boolean gerarRecebiveis = false;

    @Column(name = "valor_total_parcelas", precision = 19, scale = 2)
    private BigDecimal valorTotalParcelas;

    @Column(name = "quantidade_parcelas")
    private Integer quantidadeParcelas;

    @Column(name = "forma_pagamento_parcelas", length = 40)
    private String formaPagamentoParcelas;

    @Column(name = "whatsapp_cobranca_ativo", nullable = false)
    private Boolean whatsappCobrancaAtivo = false;

    @Column(name = "whatsapp_cobranca_horario", nullable = false, length = 5)
    private String whatsappCobrancaHorario = "09:00";

    @Column(name = "whatsapp_cobranca_antecedencia", nullable = false, length = 24)
    private String whatsappCobrancaAntecedencia = "VENCIMENTO_DIA";

    @Column(name = "whatsapp_cobranca_telefones_extras", columnDefinition = "TEXT")
    private String whatsappCobrancaTelefonesExtras;

    @Column(name = "expectativa_valor_estimado", precision = 19, scale = 2)
    private java.math.BigDecimal expectativaValorEstimado;

    @Column(name = "expectativa_base_tipo", length = 20)
    private String expectativaBaseTipo;

    @Column(name = "expectativa_valor_causa_ref", precision = 19, scale = 2)
    private java.math.BigDecimal expectativaValorCausaRef;

    @Column(name = "expectativa_observacao", columnDefinition = "TEXT")
    private String expectativaObservacao;

    @Column(name = "criado_em", nullable = false)
    private Instant criadoEm;

    @Column(name = "atualizado_em")
    private Instant atualizadoEm;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "criado_por_usuario_id")
    private UsuarioEntity criadoPorUsuario;

    @OneToMany(mappedBy = "contrato", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ContratoHonorariosParcelaEntity> parcelas = new ArrayList<>();
}
