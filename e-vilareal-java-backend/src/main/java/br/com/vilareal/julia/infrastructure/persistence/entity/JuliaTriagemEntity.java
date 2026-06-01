package br.com.vilareal.julia.infrastructure.persistence.entity;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.publicacao.infrastructure.persistence.entity.PublicacaoEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "julia_triagem")
@Getter
@Setter
public class JuliaTriagemEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "publicacao_id")
    private PublicacaoEntity publicacao;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processo_id")
    private ProcessoEntity processo;

    @Column(length = 255)
    private String classificacao;

    @Column(name = "impacto_cliente", length = 20)
    private String impactoCliente;

    @Column(length = 10)
    private String prioridade;

    @Column(precision = 4, scale = 3)
    private BigDecimal confianca;

    @Column(name = "payload_json", nullable = false, columnDefinition = "LONGTEXT")
    private String payloadJson;

    @Column(length = 60)
    private String modelo;

    @Column(name = "status_caixa", nullable = false, length = 20)
    private String statusCaixa = "AGUARDANDO_VOCE";

    @Column(length = 60)
    private String categoria;

    @Column(name = "postergar_ate")
    private LocalDate postergarAte;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;
}
