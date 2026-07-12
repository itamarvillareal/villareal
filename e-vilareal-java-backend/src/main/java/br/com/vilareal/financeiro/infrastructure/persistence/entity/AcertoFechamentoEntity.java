package br.com.vilareal.financeiro.infrastructure.persistence.entity;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Acerto como evento de fechamento (V205): "o acerto de jul/2026" do cliente na conta de acerto.
 * Fluxo: RASCUNHO (define o corte) → conferir/ajustar → registrar pagamento → compensar grupos →
 * FECHADO (arquiva o PDF do relatório e grava o saldo, que vira o "último fechamento" da Ficha).
 */
@Entity
@Table(name = "acerto_fechamento")
@Getter
@Setter
public class AcertoFechamentoEntity {

    public static final String STATUS_RASCUNHO = "RASCUNHO";
    public static final String STATUS_FECHADO = "FECHADO";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cliente_id", nullable = false)
    private ClienteEntity cliente;

    @Column(name = "numero_banco", nullable = false)
    private Integer numeroBanco;

    @Column(name = "periodo_inicio")
    private LocalDate periodoInicio;

    @Column(name = "periodo_fim")
    private LocalDate periodoFim;

    @Column(name = "data_fechamento")
    private Instant dataFechamento;

    /** Saldo pendente do cliente na conta no momento do fechamento (assinado: + a favor do cliente). */
    @Column(name = "saldo_final", precision = 19, scale = 2)
    private BigDecimal saldoFinal;

    @Column(nullable = false, length = 20)
    private String status = STATUS_RASCUNHO;

    /** Path relativo do PDF arquivado (padrão prestação de contas: {storage}/acertos/{id}/acerto.pdf). */
    @Column(name = "arquivo_pdf_path", length = 500)
    private String arquivoPdfPath;

    @Column(columnDefinition = "TEXT")
    private String observacoes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "criado_por_usuario_id")
    private UsuarioEntity criadoPorUsuario;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fechado_por_usuario_id")
    private UsuarioEntity fechadoPorUsuario;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
