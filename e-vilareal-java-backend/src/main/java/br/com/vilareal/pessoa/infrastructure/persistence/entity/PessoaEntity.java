package br.com.vilareal.pessoa.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "pessoa")
@Getter
@Setter
public class PessoaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String nome;

    @Column(nullable = true, length = 14)
    private String cpf;

    @Column(length = 255)
    private String email;

    @Column(length = 40)
    private String telefone;

    @Column(name = "telefone_digitos", length = 20)
    private String telefoneDigitos;

    @Column(name = "telefone_sufixo_8", length = 8)
    private String telefoneSufixo8;

    @Column(name = "data_nascimento")
    private LocalDate dataNascimento;

    @Column(nullable = false)
    private Boolean ativo = true;

    @Column(name = "marcado_monitoramento", nullable = false)
    private Boolean marcadoMonitoramento = false;

    /** Polo a vigiar na varredura PROJUDI por CPF/CNPJ: ATIVO, PASSIVO ou AMBOS (default). */
    @Column(name = "polo_monitorado", nullable = false, length = 10)
    private String poloMonitorado = "AMBOS";

    /** Instante em que a baseline (primeira varredura completa) foi concluída; null = sem baseline. */
    @Column(name = "baseline_em")
    private LocalDateTime baselineEm;

    /**
     * Consentimento EXPLÍCITO para receber aviso de processo novo via WhatsApp (não herda o
     * fundamento do lembrete de audiência). O envio do Bloco E é recusado no backend sem ele.
     */
    @Column(name = "aceita_aviso_processo_novo", nullable = false)
    private Boolean aceitaAvisoProcessoNovo = false;

    /** Momento do ÚLTIMO evento de consentimento (registro ou revogação). */
    @Column(name = "aviso_consentimento_em")
    private LocalDateTime avisoConsentimentoEm;

    /** Origem do último evento (ex.: "cadastro manual", "revogacao: cadastro manual"). */
    @Column(name = "aviso_consentimento_origem", length = 60)
    private String avisoConsentimentoOrigem;

    @Column(name = "importacao_id", length = 36)
    private String importacaoId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "responsavel_id")
    private PessoaEntity responsavel;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
