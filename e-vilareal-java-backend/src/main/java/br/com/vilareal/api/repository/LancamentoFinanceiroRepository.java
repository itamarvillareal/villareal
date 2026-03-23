package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.LancamentoFinanceiro;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface LancamentoFinanceiroRepository extends JpaRepository<LancamentoFinanceiro, Long> {
    @Query("SELECT l FROM LancamentoFinanceiro l " +
            "WHERE (:clienteId IS NULL OR l.cliente.id = :clienteId) " +
            "AND (:processoId IS NULL OR l.processo.id = :processoId) " +
            "AND (:contaContabilId IS NULL OR l.contaContabil.id = :contaContabilId) " +
            "AND (:dataInicio IS NULL OR l.dataLancamento >= :dataInicio) " +
            "AND (:dataFim IS NULL OR l.dataLancamento <= :dataFim) " +
            "ORDER BY l.dataLancamento DESC, l.id DESC")
    List<LancamentoFinanceiro> findAllFiltered(
            @Param("clienteId") Long clienteId,
            @Param("processoId") Long processoId,
            @Param("contaContabilId") Long contaContabilId,
            @Param("dataInicio") LocalDate dataInicio,
            @Param("dataFim") LocalDate dataFim
    );

    Optional<LancamentoFinanceiro> findByIdAndProcesso_Id(Long id, Long processoId);

    @Query("SELECT COALESCE(SUM(l.valor), 0) FROM LancamentoFinanceiro l " +
            "WHERE l.processo.id = :processoId")
    BigDecimal sumValorByProcessoId(@Param("processoId") Long processoId);
}
