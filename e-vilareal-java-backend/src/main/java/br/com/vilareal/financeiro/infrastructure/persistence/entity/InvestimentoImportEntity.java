package br.com.vilareal.financeiro.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "financeiro_investimento_import")
@Getter
@Setter
public class InvestimentoImportEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conta_bancaria_id", nullable = false)
    private ContaBancariaEntity contaBancaria;

    @Column(name = "arquivo_nome", nullable = false, length = 255)
    private String arquivoNome;

    @Column(name = "arquivo_hash", length = 64)
    private String arquivoHash;

    @Column(name = "periodo_inicio")
    private LocalDate periodoInicio;

    @Column(name = "periodo_fim")
    private LocalDate periodoFim;

    @Column(name = "total_linhas", nullable = false)
    private Integer totalLinhas = 0;

    @Column(name = "linhas_cdb", nullable = false)
    private Integer linhasCdb = 0;

    @Column(name = "linhas_vinculadas", nullable = false)
    private Integer linhasVinculadas = 0;

    @Column(nullable = false, length = 20)
    private String status = "OK";

    @Column(name = "mensagem_erro", length = 2000)
    private String mensagemErro;

    @Column(name = "importado_em", insertable = false, updatable = false)
    private Instant importadoEm;
}
