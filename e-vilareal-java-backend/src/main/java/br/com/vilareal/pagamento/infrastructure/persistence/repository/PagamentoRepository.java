package br.com.vilareal.pagamento.infrastructure.persistence.repository;

import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface PagamentoRepository extends JpaRepository<PagamentoEntity, Long>, JpaSpecificationExecutor<PagamentoEntity> {

    boolean existsByFinanceiroLancamento_Id(Long financeiroLancamentoId);

    boolean existsByFinanceiroLancamento_IdAndIdNot(Long financeiroLancamentoId, Long pagamentoId);

    @Query("""
            SELECT p FROM PagamentoEntity p
            WHERE p.status IN :statuses
              AND p.financeiroLancamento IS NULL
              AND (
                  p.dataVencimento BETWEEN :inicio AND :fim
                  OR (p.dataAgendamento IS NOT NULL AND p.dataAgendamento BETWEEN :inicio AND :fim)
              )
            ORDER BY p.dataVencimento ASC, p.id ASC
            """)
    List<PagamentoEntity> findCandidatosConciliacao(
            @Param("statuses") Collection<String> statuses,
            @Param("inicio") LocalDate inicio,
            @Param("fim") LocalDate fim);
}
