package br.com.vilareal.financeiro.infrastructure.persistence.repository;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.InvestimentoOperacaoLancamentoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface InvestimentoOperacaoLancamentoRepository extends JpaRepository<InvestimentoOperacaoLancamentoEntity, Long> {

    @Query("""
            SELECT e FROM InvestimentoOperacaoLancamentoEntity e
            JOIN FETCH e.lancamento l
            WHERE e.operacao.id IN :operacaoIds
            ORDER BY e.operacao.id ASC,
                     CASE e.papel
                         WHEN br.com.vilareal.financeiro.domain.InvestimentoOperacaoLancamentoPapel.COMPRA THEN 1
                         WHEN br.com.vilareal.financeiro.domain.InvestimentoOperacaoLancamentoPapel.VENDA THEN 2
                         WHEN br.com.vilareal.financeiro.domain.InvestimentoOperacaoLancamentoPapel.IRRF THEN 3
                         WHEN br.com.vilareal.financeiro.domain.InvestimentoOperacaoLancamentoPapel.IOF THEN 4
                         ELSE 5
                     END,
                     l.dataLancamento ASC,
                     e.id ASC
            """)
    List<InvestimentoOperacaoLancamentoEntity> findByOperacaoIdsWithLancamento(@Param("operacaoIds") Collection<Long> operacaoIds);
}
