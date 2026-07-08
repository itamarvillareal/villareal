package br.com.vilareal.documento.importacao.infrastructure.persistence.entity;

import br.com.vilareal.documento.infrastructure.persistence.entity.ContratoHonorariosEntity;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "contrato_honorarios_cobranca_armada")
@Getter
@Setter
public class ContratoHonorariosCobrancaArmadaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "contrato_honorarios_id", nullable = false, unique = true)
    private ContratoHonorariosEntity contratoHonorarios;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "importacao_id")
    private ContratoHonorariosImportacaoEntity importacao;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "armado_por_usuario_id", nullable = false)
    private UsuarioEntity armadoPorUsuario;

    @Column(name = "armado_em", nullable = false)
    private Instant armadoEm;
}
