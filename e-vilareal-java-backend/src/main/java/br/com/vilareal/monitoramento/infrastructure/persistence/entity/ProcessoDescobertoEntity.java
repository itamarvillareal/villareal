package br.com.vilareal.monitoramento.infrastructure.persistence.entity;

import br.com.vilareal.monitoramento.domain.PoloDaPessoa;
import br.com.vilareal.monitoramento.domain.SituacaoProcessoDescoberto;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDateTime;

/**
 * Linha da lista do BuscaProcesso vista para uma pessoa monitorada. Chave natural do
 * dedupe: (pessoa, numeroReduzido, anoDistribuicao) — a lista não traz CNJ completo.
 */
@Entity
@Table(name = "processo_descoberto")
@Getter
@Setter
public class ProcessoDescobertoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pessoa_id", nullable = false)
    private PessoaEntity pessoa;

    /** Número reduzido da lista (sequencial-dv, ex.: 5432153-35). */
    @Column(name = "numero_reduzido", nullable = false, length = 20)
    private String numeroReduzido;

    @Column(name = "ano_distribuicao", nullable = false)
    private Integer anoDistribuicao;

    @Column(name = "data_distribuicao")
    private LocalDateTime dataDistribuicao;

    /** Sufixo estável (12 dígitos) do Id_Processo — gravado para estudo, NÃO é chave de dedupe. */
    @Column(name = "id_processo_sufixo", length = 12)
    private String idProcessoSufixo;

    /** CNJ completo — preenchido só quando o detalhe é aberto (candidatos a NOVO). */
    @Column(name = "numero_cnj", length = 100)
    private String numeroCnj;

    @Column(length = 255)
    private String classe;

    @Column(length = 255)
    private String serventia;

    @Enumerated(EnumType.STRING)
    @Column(name = "polo_da_pessoa", nullable = false, length = 15)
    private PoloDaPessoa poloDaPessoa = PoloDaPessoa.INDETERMINADO;

    @Column(name = "partes_ativo", columnDefinition = "TEXT")
    private String partesAtivo;

    @Column(name = "partes_passivo", columnDefinition = "TEXT")
    private String partesPassivo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private SituacaoProcessoDescoberto situacao;

    /** Processo do acervo, quando o dedupe por CNJ casou (situacao=VINCULADO) ou foi cadastrado. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processo_id")
    private ProcessoEntity processo;

    /** Quando o aviso WhatsApp deste descoberto foi enviado ao cliente; preenchido = não reenvia. */
    @Column(name = "aviso_enviado_em")
    private LocalDateTime avisoEnviadoEm;

    @Column(name = "aviso_enviado_para", length = 30)
    private String avisoEnviadoPara;

    @Column(name = "primeiro_visto_em", insertable = false, updatable = false)
    private Instant primeiroVistoEm;

    @Column(name = "atualizado_em", insertable = false, updatable = false)
    private Instant atualizadoEm;
}
