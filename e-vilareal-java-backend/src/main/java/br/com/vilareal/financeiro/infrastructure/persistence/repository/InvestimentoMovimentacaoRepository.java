package br.com.vilareal.financeiro.infrastructure.persistence.repository;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.InvestimentoMovimentacaoEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface InvestimentoMovimentacaoRepository extends JpaRepository<InvestimentoMovimentacaoEntity, Long> {

    @Query("""
            SELECT m FROM InvestimentoMovimentacaoEntity m
            JOIN FETCH m.contaBancaria cb
            LEFT JOIN FETCH m.lancamentoFinanceiro
            WHERE (:contaBancariaId IS NULL OR cb.id = :contaBancariaId)
              AND (:dataInicio IS NULL OR m.dataMovimentacao >= :dataInicio)
              AND (:dataFim IS NULL OR m.dataMovimentacao <= :dataFim)
              AND (:codigoProduto IS NULL OR m.codigoProduto = :codigoProduto)
              AND m.tipoMovimentacao = 'COMPRA / VENDA'
            ORDER BY m.dataMovimentacao DESC, m.id DESC
            """)
    Page<InvestimentoMovimentacaoEntity> listarFiltrado(
            @Param("contaBancariaId") Long contaBancariaId,
            @Param("dataInicio") LocalDate dataInicio,
            @Param("dataFim") LocalDate dataFim,
            @Param("codigoProduto") String codigoProduto,
            Pageable pageable);

    @Query("""
            SELECT m FROM InvestimentoMovimentacaoEntity m
            JOIN FETCH m.contaBancaria
            WHERE m.contaBancaria.id = :contaBancariaId
              AND m.tipoMovimentacao = 'COMPRA / VENDA'
              AND m.codigoProduto IS NOT NULL
            ORDER BY m.dataMovimentacao ASC, m.id ASC
            """)
    List<InvestimentoMovimentacaoEntity> findCdbPorConta(@Param("contaBancariaId") Long contaBancariaId);

    long countByContaBancaria_IdAndLancamentoFinanceiroIsNotNull(Long contaBancariaId);
}
