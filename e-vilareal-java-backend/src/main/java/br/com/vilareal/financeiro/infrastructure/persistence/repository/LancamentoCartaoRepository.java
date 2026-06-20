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

    @Query(value = """
            SELECT l.conta_contabil_id, COUNT(*) AS total
            FROM financeiro_lancamento_cartao l
            INNER JOIN financeiro_cartao c ON c.id = l.cartao_id
            WHERE l.etapa != 'IMPORTADO'
              AND c.numero_cartao = :numeroCartao
              AND l.descricao_norm = :descricaoNorm
            GROUP BY l.conta_contabil_id
            ORDER BY total DESC
            LIMIT 3
            """, nativeQuery = true)
    List<Object[]> contarContaPorDescricaoHistoricoCartao(
            @Param("numeroCartao") Integer numeroCartao,
            @Param("descricaoNorm") String descricaoNorm);

    @Query(value = """
            SELECT l.conta_contabil_id, COUNT(*) AS total
            FROM financeiro_lancamento_cartao l
            INNER JOIN financeiro_cartao c ON c.id = l.cartao_id
            WHERE l.etapa != 'IMPORTADO'
              AND c.numero_cartao = :numeroCartao
              AND l.descricao_norm = :descricaoNorm
              AND (:excluirId IS NULL OR l.id <> :excluirId)
              AND l.data_lancamento < :dataRef
            GROUP BY l.conta_contabil_id
            ORDER BY total DESC
            LIMIT 3
            """, nativeQuery = true)
    List<Object[]> contarContaPorDescricaoHistoricoAnteriorCartao(
            @Param("numeroCartao") Integer numeroCartao,
            @Param("descricaoNorm") String descricaoNorm,
            @Param("dataRef") LocalDate dataRef,
            @Param("excluirId") Long excluirId);

    @Query(value = """
            SELECT l.conta_contabil_id, COUNT(*) AS total
            FROM financeiro_lancamento_cartao l
            INNER JOIN financeiro_cartao c ON c.id = l.cartao_id
            WHERE l.etapa != 'IMPORTADO'
              AND c.numero_cartao = :numeroCartao
              AND l.descricao_norm = :descricaoNorm
              AND (:excluirId IS NULL OR l.id <> :excluirId)
              AND l.data_lancamento > :dataRef
            GROUP BY l.conta_contabil_id
            ORDER BY total DESC
            LIMIT 3
            """, nativeQuery = true)
    List<Object[]> contarContaPorDescricaoHistoricoPosteriorCartao(
            @Param("numeroCartao") Integer numeroCartao,
            @Param("descricaoNorm") String descricaoNorm,
            @Param("dataRef") LocalDate dataRef,
            @Param("excluirId") Long excluirId);

    @Query(value = """
            SELECT l.conta_contabil_id, COUNT(*) AS total
            FROM financeiro_lancamento_cartao l
            INNER JOIN financeiro_cartao c ON c.id = l.cartao_id
            WHERE l.etapa != 'IMPORTADO'
              AND c.numero_cartao = :numeroCartao
              AND (l.descricao_norm = :descricaoNorm OR l.descricao_norm LIKE CONCAT(:chaveEstabelecimento, '%'))
              AND (:excluirId IS NULL OR l.id <> :excluirId)
              AND l.data_lancamento < :dataRef
            GROUP BY l.conta_contabil_id
            ORDER BY total DESC
            LIMIT 3
            """, nativeQuery = true)
    List<Object[]> contarContaPorChaveEstabelecimentoAnteriorCartao(
            @Param("numeroCartao") Integer numeroCartao,
            @Param("descricaoNorm") String descricaoNorm,
            @Param("chaveEstabelecimento") String chaveEstabelecimento,
            @Param("dataRef") LocalDate dataRef,
            @Param("excluirId") Long excluirId);

    @Query(value = """
            SELECT l.conta_contabil_id, COUNT(*) AS total
            FROM financeiro_lancamento_cartao l
            INNER JOIN financeiro_cartao c ON c.id = l.cartao_id
            WHERE l.etapa != 'IMPORTADO'
              AND c.numero_cartao = :numeroCartao
              AND (l.descricao_norm = :descricaoNorm OR l.descricao_norm LIKE CONCAT(:chaveEstabelecimento, '%'))
              AND (:excluirId IS NULL OR l.id <> :excluirId)
              AND l.data_lancamento > :dataRef
            GROUP BY l.conta_contabil_id
            ORDER BY total DESC
            LIMIT 3
            """, nativeQuery = true)
    List<Object[]> contarContaPorChaveEstabelecimentoPosteriorCartao(
            @Param("numeroCartao") Integer numeroCartao,
            @Param("descricaoNorm") String descricaoNorm,
            @Param("chaveEstabelecimento") String chaveEstabelecimento,
            @Param("dataRef") LocalDate dataRef,
            @Param("excluirId") Long excluirId);

    @Query(value = """
            SELECT l.conta_contabil_id, COUNT(*) AS total
            FROM financeiro_lancamento_cartao l
            INNER JOIN financeiro_cartao c ON c.id = l.cartao_id
            WHERE l.etapa != 'IMPORTADO'
              AND c.numero_cartao = :numeroCartao
              AND (l.descricao_norm = :descricaoNorm OR l.descricao_norm LIKE CONCAT(:chaveEstabelecimento, '%'))
            GROUP BY l.conta_contabil_id
            ORDER BY total DESC
            LIMIT 3
            """, nativeQuery = true)
    List<Object[]> contarContaPorChaveEstabelecimentoHistoricoCartao(
            @Param("numeroCartao") Integer numeroCartao,
            @Param("descricaoNorm") String descricaoNorm,
            @Param("chaveEstabelecimento") String chaveEstabelecimento);

    @Query("""
            SELECT l FROM LancamentoCartaoEntity l
            JOIN FETCH l.contaContabil c
            LEFT JOIN FETCH l.pessoaRef
            LEFT JOIN FETCH l.clienteEntidade
            LEFT JOIN FETCH l.processo
            WHERE l.etapa <> br.com.vilareal.financeiro.domain.EtapaLancamento.IMPORTADO
              AND l.cartao.numeroCartao = :numeroCartao
              AND l.descricaoNorm = :descricaoNorm
              AND l.valor BETWEEN :valorMin AND :valorMax
              AND (YEAR(l.dataLancamento) * 100 + MONTH(l.dataLancamento)) <> :anoMes
              AND (:excluirId IS NULL OR l.id <> :excluirId)
              AND l.dataLancamento < :dataRef
            ORDER BY l.dataLancamento DESC
            """)
    List<LancamentoCartaoEntity> findRecorrenciaCandidatosAnterioresCartao(
            @Param("numeroCartao") Integer numeroCartao,
            @Param("descricaoNorm") String descricaoNorm,
            @Param("valorMin") BigDecimal valorMin,
            @Param("valorMax") BigDecimal valorMax,
            @Param("anoMes") int anoMes,
            @Param("dataRef") LocalDate dataRef,
            @Param("excluirId") Long excluirId);

    @Query("""
            SELECT l FROM LancamentoCartaoEntity l
            JOIN FETCH l.contaContabil c
            LEFT JOIN FETCH l.pessoaRef
            LEFT JOIN FETCH l.clienteEntidade
            LEFT JOIN FETCH l.processo
            WHERE l.etapa <> br.com.vilareal.financeiro.domain.EtapaLancamento.IMPORTADO
              AND l.cartao.numeroCartao = :numeroCartao
              AND l.descricaoNorm = :descricaoNorm
              AND l.valor BETWEEN :valorMin AND :valorMax
              AND (YEAR(l.dataLancamento) * 100 + MONTH(l.dataLancamento)) <> :anoMes
              AND (:excluirId IS NULL OR l.id <> :excluirId)
              AND l.dataLancamento > :dataRef
            ORDER BY l.dataLancamento ASC
            """)
    List<LancamentoCartaoEntity> findRecorrenciaCandidatosPosterioresCartao(
            @Param("numeroCartao") Integer numeroCartao,
            @Param("descricaoNorm") String descricaoNorm,
            @Param("valorMin") BigDecimal valorMin,
            @Param("valorMax") BigDecimal valorMax,
            @Param("anoMes") int anoMes,
            @Param("dataRef") LocalDate dataRef,
            @Param("excluirId") Long excluirId);

    @Query("""
            SELECT l FROM LancamentoCartaoEntity l
            JOIN FETCH l.contaContabil c
            LEFT JOIN FETCH l.pessoaRef
            LEFT JOIN FETCH l.clienteEntidade
            LEFT JOIN FETCH l.processo
            WHERE l.etapa <> br.com.vilareal.financeiro.domain.EtapaLancamento.IMPORTADO
              AND l.cartao.numeroCartao = :numeroCartao
              AND (l.descricaoNorm = :descricaoNorm OR l.descricaoNorm LIKE CONCAT(:chaveEstabelecimento, '%'))
              AND (:excluirId IS NULL OR l.id <> :excluirId)
              AND l.dataLancamento < :dataRef
            ORDER BY l.dataLancamento DESC
            """)
    List<LancamentoCartaoEntity> findRecorrenciaPorNomeAnterioresCartao(
            @Param("numeroCartao") Integer numeroCartao,
            @Param("descricaoNorm") String descricaoNorm,
            @Param("chaveEstabelecimento") String chaveEstabelecimento,
            @Param("dataRef") LocalDate dataRef,
            @Param("excluirId") Long excluirId);

    @Query("""
            SELECT l FROM LancamentoCartaoEntity l
            JOIN FETCH l.contaContabil c
            LEFT JOIN FETCH l.pessoaRef
            LEFT JOIN FETCH l.clienteEntidade
            LEFT JOIN FETCH l.processo
            WHERE l.etapa <> br.com.vilareal.financeiro.domain.EtapaLancamento.IMPORTADO
              AND l.cartao.numeroCartao = :numeroCartao
              AND (l.descricaoNorm = :descricaoNorm OR l.descricaoNorm LIKE CONCAT(:chaveEstabelecimento, '%'))
              AND (:excluirId IS NULL OR l.id <> :excluirId)
              AND l.dataLancamento > :dataRef
            ORDER BY l.dataLancamento ASC
            """)
    List<LancamentoCartaoEntity> findRecorrenciaPorNomePosterioresCartao(
            @Param("numeroCartao") Integer numeroCartao,
            @Param("descricaoNorm") String descricaoNorm,
            @Param("chaveEstabelecimento") String chaveEstabelecimento,
            @Param("dataRef") LocalDate dataRef,
            @Param("excluirId") Long excluirId);
}
