package br.com.vilareal.financeiro.infrastructure.persistence.entity;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Ficha do Acerto por cliente (V205): regras do acordo que antes só existiam na planilha —
 * percentual de repasse e observações de parcelas internas. A mensalidade NÃO é duplicada aqui:
 * o valor vigente vem do cadastro {@code mensalista}. O "último fechamento" é derivado do último
 * {@link AcertoFechamentoEntity} FECHADO do cliente.
 */
@Entity
@Table(name = "acerto_cliente_config")
@Getter
@Setter
public class AcertoClienteConfigEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cliente_id", nullable = false, unique = true)
    private ClienteEntity cliente;

    /** Percentual do valor recebido repassado ao cliente (ex.: 80.00 = 80/20). */
    @Column(name = "percentual_repasse", precision = 5, scale = 2)
    private BigDecimal percentualRepasse;

    @Column(columnDefinition = "TEXT")
    private String observacoes;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
