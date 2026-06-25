package br.com.vilareal.financeiro.infrastructure.persistence.repository;

import br.com.vilareal.financeiro.domain.InvestimentoOperacaoStatus;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.InvestimentoOperacaoEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.math.BigDecimal;

public interface InvestimentoOperacaoRepository extends JpaRepository<InvestimentoOperacaoEntity, Long> {

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM InvestimentoOperacaoEntity o WHERE o.contaBancaria.id = :contaBancariaId")
    void deleteByContaBancariaId(@Param("contaBancariaId") Long contaBancariaId);

    @Query("""
            SELECT o FROM InvestimentoOperacaoEntity o
            JOIN FETCH o.contaBancaria cb
            LEFT JOIN FETCH o.compraMovimentacao
            LEFT JOIN FETCH o.vendaMovimentacao
            LEFT JOIN FETCH o.compraLancamento
            LEFT JOIN FETCH o.vendaLancamento
            WHERE (:contaBancariaId IS NULL OR cb.id = :contaBancariaId)
              AND (:status IS NULL OR o.status = :status)
              AND (:dataInicio IS NULL OR COALESCE(o.dataVenda, o.dataCompra) >= :dataInicio)
              AND (:dataFim IS NULL OR COALESCE(o.dataVenda, o.dataCompra) <= :dataFim)
              AND (:somenteComTaxa = false OR o.taxaMensalLiquida IS NOT NULL)
            ORDER BY COALESCE(o.dataVenda, o.dataCompra) DESC, o.id DESC
            """)
    Page<InvestimentoOperacaoEntity> listarFiltrado(
            @Param("contaBancariaId") Long contaBancariaId,
            @Param("status") InvestimentoOperacaoStatus status,
            @Param("dataInicio") LocalDate dataInicio,
            @Param("dataFim") LocalDate dataFim,
            @Param("somenteComTaxa") boolean somenteComTaxa,
            Pageable pageable);

    @Query("""
            SELECT o FROM InvestimentoOperacaoEntity o
            WHERE o.contaBancaria.id = :contaBancariaId
              AND o.status = br.com.vilareal.financeiro.domain.InvestimentoOperacaoStatus.FECHADA
              AND o.taxaMensalLiquida IS NOT NULL
            """)
    List<InvestimentoOperacaoEntity> findFechadasComTaxa(@Param("contaBancariaId") Long contaBancariaId);

    long countByContaBancaria_IdAndStatus(Long contaBancariaId, InvestimentoOperacaoStatus status);

    @Query("""
            SELECT COALESCE(SUM(o.valorCompraCaixa), 0) FROM InvestimentoOperacaoEntity o
            WHERE o.contaBancaria.id = :contaBancariaId AND o.status = br.com.vilareal.financeiro.domain.InvestimentoOperacaoStatus.ABERTA
            """)
    BigDecimal sumVolumeAberto(@Param("contaBancariaId") Long contaBancariaId);
}
