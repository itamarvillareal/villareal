package br.com.vilareal.processo.copiaidle.infrastructure.persistence.repository;

import br.com.vilareal.processo.copiaidle.domain.CopiaMovimentacoesItemStatus;
import br.com.vilareal.processo.copiaidle.infrastructure.persistence.entity.CopiaMovimentacoesClienteItemEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface CopiaMovimentacoesClienteItemRepository
        extends JpaRepository<CopiaMovimentacoesClienteItemEntity, Long> {

    Optional<CopiaMovimentacoesClienteItemEntity> findByCampanha_IdAndProcesso_Id(Long campanhaId, Long processoId);

    long countByCampanha_IdAndStatus(Long campanhaId, CopiaMovimentacoesItemStatus status);

    long countByCampanha_Id(Long campanhaId);

    @Query(
            """
            SELECT i.processo.id FROM CopiaMovimentacoesClienteItemEntity i
            WHERE i.campanha.id = :campanhaId
            """)
    Set<Long> findProcessoIdsByCampanhaId(@Param("campanhaId") Long campanhaId);

    @Query(
            """
            SELECT i FROM CopiaMovimentacoesClienteItemEntity i
            JOIN FETCH i.processo p
            WHERE i.campanha.id = :campanhaId
              AND i.status IN :statuses
            ORDER BY i.id ASC
            """)
    List<CopiaMovimentacoesClienteItemEntity> findProximosPorStatus(
            @Param("campanhaId") Long campanhaId,
            @Param("statuses") Collection<CopiaMovimentacoesItemStatus> statuses,
            Pageable pageable);
}
