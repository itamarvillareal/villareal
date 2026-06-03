package br.com.vilareal.condominio.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "cobranca_execucao")
@Getter
@Setter
public class CobrancaExecucaoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "importacao_id", nullable = false, length = 36, unique = true)
    private String importacaoId;

    @Column(name = "criado_em", nullable = false)
    private Instant criadoEm;

    @Column(name = "cliente_codigo", nullable = false, columnDefinition = "CHAR(8)")
    private String clienteCodigo;

    @Column(name = "total_titulos", nullable = false)
    private int totalTitulos;

    @Column(name = "total_inseridos", nullable = false)
    private int totalInseridos;

    @Column(name = "total_ignorados", nullable = false)
    private int totalIgnorados;

    @Column(name = "total_falhados", nullable = false)
    private int totalFalhados;

    @Column(name = "processos_criados", nullable = false)
    private int processosCriados;

    @Column(name = "revisoes_troca_dono", nullable = false)
    private int revisoesTrocaDono;

    @Column(name = "relatorio_json", nullable = false, columnDefinition = "LONGTEXT")
    private String relatorioJson;
}
