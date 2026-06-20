package br.com.vilareal.documento.infrastructure.persistence.entity;

import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "contrato_honorarios_parcela")
@Getter
@Setter
public class ContratoHonorariosParcelaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "contrato_honorarios_id", nullable = false)
    private ContratoHonorariosEntity contrato;

    @Column(name = "numero_parcela", nullable = false)
    private Integer numeroParcela;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal valor;

    @Column(name = "data_vencimento", nullable = false)
    private LocalDate dataVencimento;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pagamento_id")
    private PagamentoEntity pagamento;
}
