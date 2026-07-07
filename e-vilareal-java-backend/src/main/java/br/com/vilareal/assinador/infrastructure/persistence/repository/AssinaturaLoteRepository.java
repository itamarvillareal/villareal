package br.com.vilareal.assinador.infrastructure.persistence.repository;

import br.com.vilareal.assinador.domain.AssinaturaLoteStatus;
import br.com.vilareal.assinador.infrastructure.persistence.entity.AssinaturaLoteEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AssinaturaLoteRepository extends JpaRepository<AssinaturaLoteEntity, Long> {

    /**
     * Próximo lote liberado com lock pessimista (MySQL {@code FOR UPDATE SKIP LOCKED}).
     * Dois pollers concorrentes não bloqueiam um ao outro — o segundo recebe vazio se só há um lote.
     */
    @Query(
            value =
                    """
                    SELECT id FROM assinatura_lote
                    WHERE status = 'LIBERADO'
                    ORDER BY criado_em ASC
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED
                    """,
            nativeQuery = true)
    Optional<Long> findProximoLiberadoIdParaClaim();

    @Query("""
            SELECT l FROM AssinaturaLoteEntity l
            WHERE l.status IN :statuses
            ORDER BY l.criadoEm DESC
            """)
    List<AssinaturaLoteEntity> findByStatusIn(@Param("statuses") Collection<AssinaturaLoteStatus> statuses);

    List<AssinaturaLoteEntity> findByStatusAndCredencialIdOrderByCriadoEmDesc(
            AssinaturaLoteStatus status, Long credencialId);

    List<AssinaturaLoteEntity> findByStatusAndCriadoEmBefore(AssinaturaLoteStatus status, Instant antes);
}
