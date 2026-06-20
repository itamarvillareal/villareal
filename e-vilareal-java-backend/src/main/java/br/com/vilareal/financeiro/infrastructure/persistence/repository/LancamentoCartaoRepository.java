package br.com.vilareal.financeiro.infrastructure.persistence.repository;

import br.com.vilareal.financeiro.domain.EtapaLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoCartaoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface LancamentoCartaoRepository
        extends JpaRepository<LancamentoCartaoEntity, Long>, JpaSpecificationExecutor<LancamentoCartaoEntity> {

    long countByEtapa(EtapaLancamento etapa);

    @Query("""
            SELECT COUNT(l) FROM LancamentoCartaoEntity l
            JOIN l.contaContabil c
            WHERE UPPER(TRIM(c.codigo)) = 'A'
              AND l.clienteEntidade IS NULL
            """)
    long countContaASemCliente();

    @Query(
            """
            SELECT l FROM LancamentoCartaoEntity l
            JOIN FETCH l.cartao c
            JOIN FETCH l.contaContabil
            WHERE UPPER(TRIM(c.nome)) = :nomeNorm
            """)
    List<LancamentoCartaoEntity> findAllByCartaoNomeNormalizado(@Param("nomeNorm") String nomeNorm);

    @Query(
            """
            SELECT l FROM LancamentoCartaoEntity l
            JOIN FETCH l.cartao c
            JOIN FETCH l.contaContabil
            WHERE c.numeroCartao = :numero
            """)
    List<LancamentoCartaoEntity> findAllByNumeroCartao(@Param("numero") Integer numero);

    @Query("""
            SELECT l FROM LancamentoCartaoEntity l
            JOIN FETCH l.cartao
            JOIN FETCH l.contaContabil
            LEFT JOIN FETCH l.pessoaRef
            LEFT JOIN FETCH l.clienteEntidade
            LEFT JOIN FETCH l.processo
            WHERE l.cartao.id = :cartaoId
              AND l.dataLancamento BETWEEN :inicio AND :fim
            ORDER BY l.dataLancamento DESC, l.id DESC
            """)
    List<LancamentoCartaoEntity> findByCartaoAndPeriodo(
            @Param("cartaoId") Long cartaoId,
            @Param("inicio") java.time.LocalDate inicio,
            @Param("fim") java.time.LocalDate fim);

    Optional<LancamentoCartaoEntity> findByCartaoIdAndNumeroLancamento(Long cartaoId, String numeroLancamento);

    @Query("""
            SELECT DISTINCT l.cartao.id, l.dataCompetencia FROM LancamentoCartaoEntity l
            WHERE l.dataCompetencia IS NOT NULL
              AND l.dataCompetencia <= :ate
              AND l.numeroLancamento NOT LIKE 'AUTO-FAT-%'
            ORDER BY l.cartao.id, l.dataCompetencia
            """)
    List<Object[]> findCiclosVencidosParaFechamento(@Param("ate") LocalDate ate);

    @Query("""
            SELECT COALESCE(SUM(l.valor), 0) FROM LancamentoCartaoEntity l
            WHERE l.cartao.id = :cartaoId
              AND l.dataCompetencia = :vencimento
              AND l.numeroLancamento NOT LIKE 'AUTO-FAT-%'
            """)
    BigDecimal somaComprasCiclo(@Param("cartaoId") Long cartaoId, @Param("vencimento") LocalDate vencimento);

    @Query("""
            SELECT l FROM LancamentoCartaoEntity l
            JOIN FETCH l.cartao
            JOIN FETCH l.contaContabil
            WHERE l.cartao.id = :cartaoId
              AND l.numeroLancamento LIKE 'AUTO-FAT-%'
              AND l.dataLancamento BETWEEN :inicio AND :fim
            """)
    List<LancamentoCartaoEntity> findFechamentosAutomaticosNoPeriodo(
            @Param("cartaoId") Long cartaoId,
            @Param("inicio") LocalDate inicio,
            @Param("fim") LocalDate fim);
}
