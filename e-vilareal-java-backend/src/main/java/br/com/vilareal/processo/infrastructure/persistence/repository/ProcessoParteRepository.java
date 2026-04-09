package br.com.vilareal.processo.infrastructure.persistence.repository;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface ProcessoParteRepository extends JpaRepository<ProcessoParteEntity, Long> {

    List<ProcessoParteEntity> findByProcesso_IdOrderByOrdemAscIdAsc(Long processoId);

    long deleteByProcesso_IdAndPolo(Long processoId, String polo);

    @Query(
            """
            SELECT p FROM ProcessoParteEntity p
            LEFT JOIN FETCH p.pessoa
            LEFT JOIN FETCH p.processo
            WHERE p.processo.id IN :ids
            ORDER BY p.processo.id ASC, p.ordem ASC, p.id ASC
            """)
    List<ProcessoParteEntity> findAllByProcessoIdInWithPessoaEProcesso(@Param("ids") Collection<Long> ids);
}
