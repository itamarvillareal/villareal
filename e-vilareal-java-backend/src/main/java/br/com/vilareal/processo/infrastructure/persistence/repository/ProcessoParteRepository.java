package br.com.vilareal.processo.infrastructure.persistence.repository;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ProcessoParteRepository extends JpaRepository<ProcessoParteEntity, Long> {

    List<ProcessoParteEntity> findByProcesso_IdOrderByOrdemAscIdAsc(Long processoId);

    Optional<ProcessoParteEntity> findFirstByProcesso_IdAndPoloIgnoreCaseAndQualificacaoIgnoreCaseOrderByIdAsc(
            Long processoId, String polo, String qualificacao);

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

    @Query(
            """
            SELECT DISTINCT pp.processo.id FROM ProcessoParteEntity pp
            WHERE pp.pessoa IS NULL
              AND pp.nomeLivre IS NOT NULL
              AND TRIM(pp.nomeLivre) <> ''
              AND (
                UPPER(TRIM(pp.nomeLivre)) = UPPER(TRIM(:nome))
                OR (LENGTH(TRIM(:nome)) >= 10 AND UPPER(TRIM(pp.nomeLivre)) LIKE CONCAT('%', UPPER(TRIM(:nome)), '%'))
              )
            """)
    List<Long> findDistinctProcessoIdsByNomeLivreSemPessoa(@Param("nome") String nome);

    long countByImportacaoId(String importacaoId);

    long deleteByImportacaoId(String importacaoId);
}
