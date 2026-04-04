package br.com.vilareal.financeiro.infrastructure.persistence.repository;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface LancamentoFinanceiroRepository extends JpaRepository<LancamentoFinanceiroEntity, Long>,
        JpaSpecificationExecutor<LancamentoFinanceiroEntity> {

    @EntityGraph(attributePaths = {"contaContabil", "cliente", "processo"})
    @Override
    List<LancamentoFinanceiroEntity> findAll(Specification<LancamentoFinanceiroEntity> spec, Sort sort);

    @EntityGraph(attributePaths = {"contaContabil", "cliente", "processo"})
    @Override
    Page<LancamentoFinanceiroEntity> findAll(Specification<LancamentoFinanceiroEntity> spec, Pageable pageable);

    long countByProcesso_Id(Long processoId);

    @Query(value = """
            SELECT COALESCE(SUM(CASE WHEN natureza = 'CREDITO' THEN valor ELSE -valor END), 0)
            FROM financeiro_lancamento
            WHERE processo_id = :processoId
            """, nativeQuery = true)
    BigDecimal sumSaldoAssinadoPorProcesso(@Param("processoId") Long processoId);
}
