package br.com.vilareal.patrimonio.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "patrimonio_imovel")
@Getter
@Setter
public class ImovelPatrimonioEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String identificacao;

    @Column(length = 500)
    private String endereco;

    @Column(name = "valor_aquisicao", precision = 19, scale = 2)
    private BigDecimal valorAquisicao;

    @Column(name = "data_aquisicao")
    private LocalDate dataAquisicao;

    @Column(name = "valor_atual", nullable = false, precision = 19, scale = 2)
    private BigDecimal valorAtual = BigDecimal.ZERO;

    @Column(nullable = false, length = 30)
    private String situacao = "USO_PROPRIO";

    @Column(name = "aluguel_mensal", precision = 19, scale = 2)
    private BigDecimal aluguelMensal;

    @Column(name = "indice_reajuste", length = 30)
    private String indiceReajuste;

    @Column(name = "data_base_reajuste")
    private LocalDate dataBaseReajuste;

    @Column(name = "vencimento_contrato")
    private LocalDate vencimentoContrato;

    @Column(name = "iptu_mensal", precision = 19, scale = 2)
    private BigDecimal iptuMensal;

    @Column(name = "condominio_mensal", precision = 19, scale = 2)
    private BigDecimal condominioMensal;

    @Column(name = "seguro_mensal", precision = 19, scale = 2)
    private BigDecimal seguroMensal;

    @Column(name = "manutencao_mensal", precision = 19, scale = 2)
    private BigDecimal manutencaoMensal;

    @Column(name = "administracao_mensal", precision = 19, scale = 2)
    private BigDecimal administracaoMensal;

    @Column(name = "vacancia_estimada", precision = 8, scale = 4)
    private BigDecimal vacanciaEstimada;

    @Column(name = "origem_imovel_id")
    private Long origemImovelId;

    @Column(name = "passivo_id")
    private Long passivoId;

    @Column(nullable = false)
    private Boolean ativo = true;

    @Column(length = 500)
    private String observacao;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        if (situacao == null) situacao = "USO_PROPRIO";
        if (ativo == null) ativo = true;
        if (valorAtual == null) valorAtual = BigDecimal.ZERO;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
