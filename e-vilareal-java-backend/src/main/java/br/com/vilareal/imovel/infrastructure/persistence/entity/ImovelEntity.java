package br.com.vilareal.imovel.infrastructure.persistence.entity;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "imovel")
@Getter
@Setter
public class ImovelEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Mesmo significado de {@code clienteId} na API (pessoa do cliente / GET /api/clientes); opcional na importação. */
    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "pessoa_id", nullable = true)
    private PessoaEntity pessoa;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processo_id")
    private ProcessoEntity processo;

    /** Código numérico da coluna A da planilha `imoveis.xlsx` (único quando preenchido). */
    @Column(name = "numero_planilha")
    private Integer numeroPlanilha;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "responsavel_pessoa_id")
    private PessoaEntity responsavelPessoa;

    @Column(length = 255)
    private String titulo;

    @Column(name = "endereco_completo", columnDefinition = "TEXT")
    private String enderecoCompleto;

    @Column(length = 255)
    private String condominio;

    @Column(length = 120)
    private String unidade;

    @Column(name = "tipo_imovel", length = 80)
    private String tipoImovel;

    @Column(nullable = false, length = 40)
    private String situacao = "DESOCUPADO";

    @Column(length = 80)
    private String garagens;

    @Column(name = "inscricao_imobiliaria", length = 120)
    private String inscricaoImobiliaria;

    @Column(columnDefinition = "TEXT")
    private String observacoes;

    @Column(name = "campos_extras_json", columnDefinition = "TEXT")
    private String camposExtrasJson;

    @Column(nullable = false)
    private Boolean ativo = true;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
