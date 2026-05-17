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
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface LancamentoFinanceiroRepository extends JpaRepository<LancamentoFinanceiroEntity, Long>,
        JpaSpecificationExecutor<LancamentoFinanceiroEntity> {

    @Query("""
            FROM LancamentoFinanceiroEntity l
            WHERE UPPER(TRIM(COALESCE(l.bancoNome, ''))) = :bn
            """)
    List<LancamentoFinanceiroEntity> findAllByBancoNormalizado(@Param("bn") String bancoNormalizado);

    List<LancamentoFinanceiroEntity> findAllByNumeroBanco(Integer numeroBanco);

    Optional<LancamentoFinanceiroEntity> findByNumeroLancamento(String numeroLancamento);

    List<LancamentoFinanceiroEntity> findByNumeroLancamentoIn(Collection<String> numerosLancamento);

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

    @Query(value = """
            SELECT COALESCE(SUM(CASE WHEN natureza = 'CREDITO' THEN valor ELSE -valor END), 0)
            FROM financeiro_lancamento
            WHERE numero_banco = :numeroBanco
            """, nativeQuery = true)
    BigDecimal sumSaldoAssinadoPorNumeroBanco(@Param("numeroBanco") Integer numeroBanco);

    @Query(value = """
            SELECT MAX(data_lancamento)
            FROM financeiro_lancamento
            WHERE numero_banco = :numeroBanco
            """, nativeQuery = true)
    LocalDate findDataUltimoLancamentoPorNumeroBanco(@Param("numeroBanco") Integer numeroBanco);

    long countByNumeroBanco(Integer numeroBanco);

    @Query("SELECT l.etapa, COUNT(l) FROM LancamentoFinanceiroEntity l GROUP BY l.etapa")
    List<Object[]> contarPorEtapa();

    @Query(value = """
            SELECT conta_contabil_id, COUNT(*) AS total
            FROM financeiro_lancamento
            WHERE etapa != 'IMPORTADO'
              AND (:numeroBanco IS NULL OR numero_banco = :numeroBanco)
              AND UPPER(descricao) = UPPER(:descricao)
            GROUP BY conta_contabil_id
            ORDER BY total DESC
            LIMIT 3
            """, nativeQuery = true)
    List<Object[]> contarContaPorDescricaoHistorico(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("descricao") String descricao);

    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            JOIN FETCH l.contaContabil c
            LEFT JOIN FETCH l.cliente
            LEFT JOIN FETCH l.processo
            WHERE l.etapa <> br.com.vilareal.financeiro.domain.EtapaLancamento.IMPORTADO
              AND l.numeroBanco = :numeroBanco
              AND UPPER(l.descricao) = UPPER(:descricao)
              AND l.valor BETWEEN :valorMin AND :valorMax
              AND (YEAR(l.dataLancamento) * 100 + MONTH(l.dataLancamento)) <> :anoMes
            ORDER BY l.dataLancamento DESC
            """)
    List<LancamentoFinanceiroEntity> findRecorrenciaCandidatos(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("descricao") String descricao,
            @Param("valorMin") java.math.BigDecimal valorMin,
            @Param("valorMax") java.math.BigDecimal valorMax,
            @Param("anoMes") int anoMes);

    @EntityGraph(attributePaths = {"contaContabil", "cliente", "processo"})
    List<LancamentoFinanceiroEntity> findAllByGrupoCompensacao(String grupoCompensacao);

    @EntityGraph(attributePaths = {"contaContabil", "cliente", "processo"})
    List<LancamentoFinanceiroEntity> findAllByIdIn(Collection<Long> ids);

    @Query(value = """
            SELECT a.id, b.id, a.numero_banco, b.numero_banco
            FROM financeiro_lancamento a
            INNER JOIN financeiro_lancamento b ON
                ABS(DATEDIFF(a.data_lancamento, b.data_lancamento)) <= :diasTolerancia
                AND a.valor = b.valor
                AND a.natureza <> b.natureza
                AND a.id < b.id
            WHERE a.etapa IN ('IMPORTADO', 'CLASSIFICADO')
              AND b.etapa IN ('IMPORTADO', 'CLASSIFICADO')
              AND (a.grupo_compensacao IS NULL OR a.grupo_compensacao = '')
              AND (b.grupo_compensacao IS NULL OR b.grupo_compensacao = '')
              AND (:numeroBanco IS NULL OR a.numero_banco = :numeroBanco OR b.numero_banco = :numeroBanco)
              AND (:ano IS NULL OR (YEAR(a.data_lancamento) = :ano AND MONTH(a.data_lancamento) = :mes))
              AND (:apenasInterbancario = false OR a.numero_banco <> b.numero_banco)
            ORDER BY a.data_lancamento DESC
            LIMIT :limit OFFSET :offset
            """, nativeQuery = true)
    List<Object[]> findParesCompensacaoSugeridosIds(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("ano") Integer ano,
            @Param("mes") Integer mes,
            @Param("diasTolerancia") int diasTolerancia,
            @Param("apenasInterbancario") boolean apenasInterbancario,
            @Param("limit") int limit,
            @Param("offset") int offset);

    @Query(value = """
            SELECT COUNT(*)
            FROM financeiro_lancamento a
            INNER JOIN financeiro_lancamento b ON
                ABS(DATEDIFF(a.data_lancamento, b.data_lancamento)) <= :diasTolerancia
                AND a.valor = b.valor
                AND a.natureza <> b.natureza
                AND a.id < b.id
            WHERE a.etapa IN ('IMPORTADO', 'CLASSIFICADO')
              AND b.etapa IN ('IMPORTADO', 'CLASSIFICADO')
              AND (a.grupo_compensacao IS NULL OR a.grupo_compensacao = '')
              AND (b.grupo_compensacao IS NULL OR b.grupo_compensacao = '')
              AND (:numeroBanco IS NULL OR a.numero_banco = :numeroBanco OR b.numero_banco = :numeroBanco)
              AND (:ano IS NULL OR (YEAR(a.data_lancamento) = :ano AND MONTH(a.data_lancamento) = :mes))
              AND (:apenasInterbancario = false OR a.numero_banco <> b.numero_banco)
            """, nativeQuery = true)
    long countParesCompensacaoSugeridos(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("ano") Integer ano,
            @Param("mes") Integer mes,
            @Param("diasTolerancia") int diasTolerancia,
            @Param("apenasInterbancario") boolean apenasInterbancario);

    @Query(value = """
            SELECT grupo_compensacao,
                   SUM(CASE WHEN natureza = 'CREDITO' THEN valor ELSE -valor END) AS soma,
                   COUNT(*) AS total
            FROM financeiro_lancamento
            WHERE grupo_compensacao IS NOT NULL AND grupo_compensacao <> ''
            GROUP BY grupo_compensacao
            HAVING ABS(SUM(CASE WHEN natureza = 'CREDITO' THEN valor ELSE -valor END)) > 0.01
            ORDER BY ABS(SUM(CASE WHEN natureza = 'CREDITO' THEN valor ELSE -valor END)) DESC
            LIMIT :limit OFFSET :offset
            """, nativeQuery = true)
    List<Object[]> findGruposCompensacaoInconsistentesResumo(
            @Param("limit") int limit,
            @Param("offset") int offset);

    @Query(value = """
            SELECT COUNT(*) FROM (
                SELECT grupo_compensacao
                FROM financeiro_lancamento
                WHERE grupo_compensacao IS NOT NULL AND grupo_compensacao <> ''
                GROUP BY grupo_compensacao
                HAVING ABS(SUM(CASE WHEN natureza = 'CREDITO' THEN valor ELSE -valor END)) > 0.01
            ) g
            """, nativeQuery = true)
    long countGruposCompensacaoInconsistentes();

    @Query(value = """
            SELECT COUNT(*)
            FROM financeiro_lancamento l
            INNER JOIN financeiro_conta_contabil c ON c.id = l.conta_contabil_id
            WHERE UPPER(c.codigo) = 'A'
              AND l.cliente_id IS NULL
            """, nativeQuery = true)
    long countContaASemCliente();

    @Query(value = """
            SELECT YEAR(data_lancamento) AS ano,
                   MONTH(data_lancamento) AS mes,
                   COUNT(*) AS total,
                   SUM(CASE WHEN etapa = 'IMPORTADO' THEN 1 ELSE 0 END) AS pendentes
            FROM financeiro_lancamento
            WHERE data_lancamento >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
            GROUP BY YEAR(data_lancamento), MONTH(data_lancamento)
            ORDER BY ano DESC, mes DESC
            """, nativeQuery = true)
    List<Object[]> findMesesAbertosResumo();

    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            JOIN FETCH l.contaContabil
            LEFT JOIN FETCH l.cliente
            LEFT JOIN FETCH l.processo
            WHERE l.numeroBanco = :numeroBanco
              AND l.dataLancamento BETWEEN :inicio AND :fim
            """)
    List<LancamentoFinanceiroEntity> findByNumeroBancoAndMes(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("inicio") java.time.LocalDate inicio,
            @Param("fim") java.time.LocalDate fim);
}
