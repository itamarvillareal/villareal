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

    @Query("""
            SELECT DISTINCT p FROM PagamentoEntity p
            LEFT JOIN FETCH p.imovel im
            WHERE p.status = :status
              AND p.prestacaoContas IS NULL
              AND (p.cliente.id = :clienteId OR im.cliente.id = :clienteId)
              AND (
                  :periodoInicio IS NULL OR :periodoFim IS NULL
                  OR (p.dataPagamentoEfetivo IS NOT NULL
                      AND p.dataPagamentoEfetivo BETWEEN :periodoInicio AND :periodoFim)
                  OR (p.dataConferencia IS NOT NULL
                      AND p.dataConferencia BETWEEN :periodoInicio AND :periodoFim)
              )
            ORDER BY im.id, p.dataVencimento, p.id
            """)
    List<PagamentoEntity> findPendentesPrestacaoContas(
            @Param("status") String status,
            @Param("clienteId") Long clienteId,
            @Param("periodoInicio") LocalDate periodoInicio,
            @Param("periodoFim") LocalDate periodoFim);
}
