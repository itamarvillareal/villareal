package br.com.vilareal.imovel.infrastructure.persistence.entity;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "imovel_vinculo_locatario")
@Getter
@Setter
public class ImovelVinculoLocatarioEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "numero_planilha", nullable = false)
    private Integer numeroPlanilha;

    @Column(name = "codigo_cliente", nullable = false, columnDefinition = "CHAR(8)")
    private String codigoCliente;

    @Column(name = "numero_interno", nullable = false)
    private Integer numeroInterno;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processo_id")
    private ProcessoEntity processo;

    @Column(name = "campos_extras_json", columnDefinition = "TEXT")
    private String camposExtrasJson;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
