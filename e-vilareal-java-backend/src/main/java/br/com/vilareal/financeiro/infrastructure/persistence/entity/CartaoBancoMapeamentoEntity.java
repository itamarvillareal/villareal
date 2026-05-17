package br.com.vilareal.financeiro.infrastructure.persistence.entity;

import br.com.vilareal.financeiro.domain.TipoMatchFatura;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "financeiro_cartao_banco_mapeamento")
@Getter
@Setter
public class CartaoBancoMapeamentoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cartao_id", nullable = false)
    private CartaoEntity cartao;

    @Column(name = "numero_banco", nullable = false)
    private Integer numeroBanco;

    @Column(name = "padrao_descricao", nullable = false, length = 255)
    private String padraoDescricao;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_match", nullable = false, length = 20)
    private TipoMatchFatura tipoMatch = TipoMatchFatura.CONTAINS;

    @Column(name = "tolerancia_valor", nullable = false, precision = 5, scale = 4)
    private BigDecimal toleranciaValor = new BigDecimal("0.05");

    @Column(name = "tolerancia_dias", nullable = false)
    private Integer toleranciaDias = 31;

    @Column(nullable = false)
    private Boolean ativo = true;
}
