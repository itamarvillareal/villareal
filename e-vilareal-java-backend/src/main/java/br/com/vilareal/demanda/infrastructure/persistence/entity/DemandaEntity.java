package br.com.vilareal.demanda.infrastructure.persistence.entity;

import br.com.vilareal.demanda.domain.DemandaDominio;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
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
@Table(name = "demanda")
@Getter
@Setter
public class DemandaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "imovel_id", nullable = false)
    private ImovelEntity imovel;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cliente_id", nullable = false)
    private ClienteEntity cliente;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pagamento_id")
    private PagamentoEntity pagamento;

    @Column(nullable = false, length = 500)
    private String descricao;

    @Column(nullable = false, length = 50)
    private String categoria;

    @Column(name = "fornecedor_texto", length = 255)
    private String fornecedorTexto;

    @Column(nullable = false, length = 30)
    private String status = DemandaDominio.STATUS_ABERTO;

    @Column(name = "gera_valor_contabil", nullable = false)
    private Boolean geraValorContabil = false;

    @Column(name = "valor_estimado", precision = 15, scale = 2)
    private BigDecimal valorEstimado;

    @Column(name = "pago_pelo_escritorio", nullable = false)
    private Boolean pagoPeloEscritorio = false;

    @Column(name = "reembolsavel_cliente", nullable = false)
    private Boolean reembolsavelCliente = false;

    @Column(name = "prazo_cumprimento")
    private LocalDate prazoCumprimento;

    @Column(name = "prazo_finalizacao")
    private LocalDate prazoFinalizacao;

    @Column(columnDefinition = "TEXT")
    private String observacoes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "criado_por")
    private UsuarioEntity criadoPor;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "demanda", fetch = FetchType.LAZY)
    @OrderBy("createdAt DESC")
    private List<DemandaHistoricoEntity> historico = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        if (status == null) {
            status = DemandaDominio.STATUS_ABERTO;
        }
        if (geraValorContabil == null) {
            geraValorContabil = false;
        }
        if (pagoPeloEscritorio == null) {
            pagoPeloEscritorio = false;
        }
        if (reembolsavelCliente == null) {
            reembolsavelCliente = false;
        }
    }
}
