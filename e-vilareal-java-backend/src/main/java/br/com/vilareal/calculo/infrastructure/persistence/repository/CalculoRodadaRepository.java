package br.com.vilareal.calculo.infrastructure.persistence.repository;

import br.com.vilareal.calculo.infrastructure.persistence.entity.CalculoRodadaEntity;
import br.com.vilareal.calculo.infrastructure.persistence.projection.CalculoRodadaResumoProjection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface CalculoRodadaRepository extends JpaRepository<CalculoRodadaEntity, Long> {

    Optional<CalculoRodadaEntity> findByCodigoClienteAndNumeroProcessoAndDimensao(
            String codigoCliente, Integer numeroProcesso, Integer dimensao);

    /**
     * Metadados de todas as rodadas sem acessar {@code payload_json} (LAZY não é disparado).
     */
    @Query(
            """
            SELECT new br.com.vilareal.calculo.infrastructure.persistence.projection.CalculoRodadaResumoProjection(
                r.codigoCliente, r.numeroProcesso, r.dimensao, r.parcelamentoAceito)
            FROM CalculoRodadaEntity r
            WHERE r.codigoCliente IS NOT NULL
              AND r.numeroProcesso IS NOT NULL
              AND r.dimensao IS NOT NULL
            """)
    List<CalculoRodadaResumoProjection> findAllResumo();

    long countByImportacaoId(String importacaoId);

    long deleteByImportacaoId(String importacaoId);
}
