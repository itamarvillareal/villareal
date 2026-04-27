package br.com.vilareal.iptu.infrastructure.persistence.entity;

import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "iptu_anual")
@Getter
@Setter
public class IptuAnualEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "imovel_id", nullable = false)
    private ImovelEntity imovel;

    @Column(name = "ano_referencia", nullable = false)
    private Short anoReferencia;

    @Column(name = "valor_total_anual", nullable = false, precision = 12, scale = 2)
    private BigDecimal valorTotalAnual;

    @Column(name = "dias_mes_divisor", nullable = false)
    private Byte diasMesDivisor = 30;

    @Column(columnDefinition = "TEXT")
    private String observacoes;

    @Column(name = "anexo_carne_path", length = 500)
    private String anexoCarnePath;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
