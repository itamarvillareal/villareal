package br.com.vilareal.processo.infrastructure.persistence.repository;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProcessoRepository extends JpaRepository<ProcessoEntity, Long> {

    @Query(
            """
            SELECT p FROM ProcessoEntity p
            WHERE p.pessoa.id = :pessoaId
              AND LOWER(TRIM(p.unidade)) = LOWER(TRIM(:unidade))
              AND p.unidade IS NOT NULL
              AND TRIM(p.unidade) <> ''
            """)
    Optional<ProcessoEntity> findByPessoa_IdAndUnidade(@Param("pessoaId") Long pessoaId, @Param("unidade") String unidade);

    @Query(
            """
            SELECT DISTINCT p FROM ProcessoEntity p
            WHERE p.pessoa.id = :pid
               OR p.id IN (SELECT pp.processo.id FROM ProcessoParteEntity pp
                           WHERE pp.pessoa IS NOT NULL AND pp.pessoa.id = :pid)
               OR p.id IN (SELECT adv.processoParte.processo.id FROM ProcessoParteAdvogadoEntity adv
                           WHERE adv.advogadoPessoa.id = :pid)
            """)
    List<ProcessoEntity> findAllDistinctVinculadosPessoa(@Param("pid") Long pid);

    List<ProcessoEntity> findByPessoa_IdOrderByNumeroInternoAsc(Long pessoaId);

    Optional<ProcessoEntity> findByPessoa_IdAndNumeroInterno(Long pessoaId, Integer numeroInterno);

    /** Todos os processos com esse nº interno (há um por cliente titular). */
    List<ProcessoEntity> findByNumeroInternoOrderByIdAsc(Integer numeroInterno);
}
