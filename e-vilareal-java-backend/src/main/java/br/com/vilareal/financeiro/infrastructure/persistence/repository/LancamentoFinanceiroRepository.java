package br.com.vilareal.financeiro.infrastructure.persistence.repository;

import br.com.vilareal.financeiro.domain.CompensacaoSqlDiaUtil;
import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import br.com.vilareal.financeiro.domain.EtapaLancamento;
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

    boolean existsByNumeroBancoAndNumeroLancamento(Integer numeroBanco, String numeroLancamento);

    @Query("""
            SELECT l.numeroLancamento FROM LancamentoFinanceiroEntity l
            WHERE l.numeroBanco = :numeroBanco AND l.numeroLancamento IN :numerosLancamento
            """)
    List<String> findNumeroLancamentoExistentesPorBanco(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("numerosLancamento") Collection<String> numerosLancamento);

    List<LancamentoFinanceiroEntity> findByNumeroLancamentoIn(Collection<String> numerosLancamento);

    @EntityGraph(attributePaths = {"contaContabil", "pessoaRef", "clienteEntidade", "processo"})
    @Override
    List<LancamentoFinanceiroEntity> findAll(Specification<LancamentoFinanceiroEntity> spec, Sort sort);

    @EntityGraph(attributePaths = {"contaContabil", "pessoaRef", "clienteEntidade", "processo"})
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
            SELECT COALESCE(SUM(CASE WHEN natureza = 'CREDITO' THEN valor ELSE -valor END), 0)
            FROM financeiro_lancamento
            WHERE numero_banco = :numeroBanco
              AND data_lancamento <= :dataAte
            """, nativeQuery = true)
    BigDecimal sumSaldoAssinadoPorNumeroBancoAteData(
            @Param("numeroBanco") Integer numeroBanco, @Param("dataAte") LocalDate dataAte);

    @Query(value = """
            SELECT COALESCE(SUM(CASE WHEN natureza = 'CREDITO' THEN valor ELSE -valor END), 0)
            FROM financeiro_lancamento
            WHERE numero_banco = :numeroBanco
              AND data_lancamento = :dataDia
            """, nativeQuery = true)
    BigDecimal sumSaldoAssinadoPorNumeroBancoNoDia(
            @Param("numeroBanco") Integer numeroBanco, @Param("dataDia") LocalDate dataDia);

    @Query(value = """
            SELECT COUNT(*)
            FROM financeiro_lancamento
            WHERE numero_banco = :numeroBanco
              AND data_lancamento <= :dataAte
            """, nativeQuery = true)
    long countByNumeroBancoAteData(@Param("numeroBanco") Integer numeroBanco, @Param("dataAte") LocalDate dataAte);

    @Query(value = """
            SELECT COUNT(*)
            FROM financeiro_lancamento
            WHERE numero_banco = :numeroBanco
              AND data_lancamento = :dataDia
            """, nativeQuery = true)
    long countByNumeroBancoNoDia(@Param("numeroBanco") Integer numeroBanco, @Param("dataDia") LocalDate dataDia);

    @Query(value = """
            SELECT data_lancamento,
                   COALESCE(SUM(CASE WHEN natureza = 'CREDITO' THEN valor ELSE -valor END), 0),
                   COUNT(*)
            FROM financeiro_lancamento
            WHERE numero_banco = :numeroBanco
              AND data_lancamento >= :dataInicio
              AND data_lancamento <= :dataFim
            GROUP BY data_lancamento
            ORDER BY data_lancamento
            """, nativeQuery = true)
    List<Object[]> sumMovimentoPorDiaNoPeriodo(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("dataInicio") LocalDate dataInicio,
            @Param("dataFim") LocalDate dataFim);

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
              AND descricao_norm = :descricaoNorm
            GROUP BY conta_contabil_id
            ORDER BY total DESC
            LIMIT 3
            """, nativeQuery = true)
    List<Object[]> contarContaPorDescricaoHistorico(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("descricaoNorm") String descricaoNorm);

    @Query(value = """
            SELECT conta_contabil_id, COUNT(*) AS total
            FROM financeiro_lancamento
            WHERE etapa != 'IMPORTADO'
              AND (:numeroBanco IS NULL OR numero_banco = :numeroBanco)
              AND descricao_norm = :descricaoNorm
              AND (:excluirId IS NULL OR id <> :excluirId)
              AND data_lancamento < :dataRef
            GROUP BY conta_contabil_id
            ORDER BY total DESC
            LIMIT 3
            """, nativeQuery = true)
    List<Object[]> contarContaPorDescricaoHistoricoAnterior(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("descricaoNorm") String descricaoNorm,
            @Param("dataRef") java.time.LocalDate dataRef,
            @Param("excluirId") Long excluirId);

    @Query(value = """
            SELECT conta_contabil_id, COUNT(*) AS total
            FROM financeiro_lancamento
            WHERE etapa != 'IMPORTADO'
              AND (:numeroBanco IS NULL OR numero_banco = :numeroBanco)
              AND descricao_norm = :descricaoNorm
              AND (:excluirId IS NULL OR id <> :excluirId)
              AND data_lancamento > :dataRef
            GROUP BY conta_contabil_id
            ORDER BY total DESC
            LIMIT 3
            """, nativeQuery = true)
    List<Object[]> contarContaPorDescricaoHistoricoPosterior(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("descricaoNorm") String descricaoNorm,
            @Param("dataRef") java.time.LocalDate dataRef,
            @Param("excluirId") Long excluirId);

    @Query(value = """
            SELECT conta_contabil_id, COUNT(*) AS total
            FROM financeiro_lancamento
            WHERE etapa != 'IMPORTADO'
              AND (:numeroBanco IS NULL OR numero_banco = :numeroBanco)
              AND (descricao_norm = :descricaoNorm OR descricao_norm LIKE CONCAT(:chaveEstabelecimento, '%'))
              AND (:excluirId IS NULL OR id <> :excluirId)
              AND data_lancamento < :dataRef
            GROUP BY conta_contabil_id
            ORDER BY total DESC
            LIMIT 3
            """, nativeQuery = true)
    List<Object[]> contarContaPorChaveEstabelecimentoAnterior(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("descricaoNorm") String descricaoNorm,
            @Param("chaveEstabelecimento") String chaveEstabelecimento,
            @Param("dataRef") java.time.LocalDate dataRef,
            @Param("excluirId") Long excluirId);

    @Query(value = """
            SELECT conta_contabil_id, COUNT(*) AS total
            FROM financeiro_lancamento
            WHERE etapa != 'IMPORTADO'
              AND (:numeroBanco IS NULL OR numero_banco = :numeroBanco)
              AND (descricao_norm = :descricaoNorm OR descricao_norm LIKE CONCAT(:chaveEstabelecimento, '%'))
              AND (:excluirId IS NULL OR id <> :excluirId)
              AND data_lancamento > :dataRef
            GROUP BY conta_contabil_id
            ORDER BY total DESC
            LIMIT 3
            """, nativeQuery = true)
    List<Object[]> contarContaPorChaveEstabelecimentoPosterior(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("descricaoNorm") String descricaoNorm,
            @Param("chaveEstabelecimento") String chaveEstabelecimento,
            @Param("dataRef") java.time.LocalDate dataRef,
            @Param("excluirId") Long excluirId);

    @Query(value = """
            SELECT conta_contabil_id, COUNT(*) AS total
            FROM financeiro_lancamento
            WHERE etapa != 'IMPORTADO'
              AND (:numeroBanco IS NULL OR numero_banco = :numeroBanco)
              AND (descricao_norm = :descricaoNorm OR descricao_norm LIKE CONCAT(:chaveEstabelecimento, '%'))
            GROUP BY conta_contabil_id
            ORDER BY total DESC
            LIMIT 3
            """, nativeQuery = true)
    List<Object[]> contarContaPorChaveEstabelecimentoHistorico(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("descricaoNorm") String descricaoNorm,
            @Param("chaveEstabelecimento") String chaveEstabelecimento);

    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            JOIN FETCH l.contaContabil c
            LEFT JOIN FETCH l.pessoaRef
            LEFT JOIN FETCH l.clienteEntidade
            LEFT JOIN FETCH l.processo
            WHERE l.etapa <> br.com.vilareal.financeiro.domain.EtapaLancamento.IMPORTADO
              AND l.numeroBanco = :numeroBanco
              AND l.descricaoNorm = :descricaoNorm
              AND l.valor BETWEEN :valorMin AND :valorMax
              AND (YEAR(l.dataLancamento) * 100 + MONTH(l.dataLancamento)) <> :anoMes
              AND (:excluirId IS NULL OR l.id <> :excluirId)
              AND l.dataLancamento < :dataRef
            ORDER BY l.dataLancamento DESC
            """)
    List<LancamentoFinanceiroEntity> findRecorrenciaCandidatosAnteriores(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("descricaoNorm") String descricaoNorm,
            @Param("valorMin") java.math.BigDecimal valorMin,
            @Param("valorMax") java.math.BigDecimal valorMax,
            @Param("anoMes") int anoMes,
            @Param("dataRef") java.time.LocalDate dataRef,
            @Param("excluirId") Long excluirId);

    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            JOIN FETCH l.contaContabil c
            LEFT JOIN FETCH l.pessoaRef
            LEFT JOIN FETCH l.clienteEntidade
            LEFT JOIN FETCH l.processo
            WHERE l.etapa <> br.com.vilareal.financeiro.domain.EtapaLancamento.IMPORTADO
              AND l.numeroBanco = :numeroBanco
              AND l.descricaoNorm = :descricaoNorm
              AND l.valor BETWEEN :valorMin AND :valorMax
              AND (YEAR(l.dataLancamento) * 100 + MONTH(l.dataLancamento)) <> :anoMes
              AND (:excluirId IS NULL OR l.id <> :excluirId)
              AND l.dataLancamento > :dataRef
            ORDER BY l.dataLancamento ASC
            """)
    List<LancamentoFinanceiroEntity> findRecorrenciaCandidatosPosteriores(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("descricaoNorm") String descricaoNorm,
            @Param("valorMin") java.math.BigDecimal valorMin,
            @Param("valorMax") java.math.BigDecimal valorMax,
            @Param("anoMes") int anoMes,
            @Param("dataRef") java.time.LocalDate dataRef,
            @Param("excluirId") Long excluirId);

    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            JOIN FETCH l.contaContabil c
            LEFT JOIN FETCH l.pessoaRef
            LEFT JOIN FETCH l.clienteEntidade
            LEFT JOIN FETCH l.processo
            WHERE l.etapa <> br.com.vilareal.financeiro.domain.EtapaLancamento.IMPORTADO
              AND l.numeroBanco = :numeroBanco
              AND (l.descricaoNorm = :descricaoNorm OR l.descricaoNorm LIKE CONCAT(:chaveEstabelecimento, '%'))
              AND (:excluirId IS NULL OR l.id <> :excluirId)
              AND l.dataLancamento < :dataRef
            ORDER BY l.dataLancamento DESC
            """)
    List<LancamentoFinanceiroEntity> findRecorrenciaPorNomeAnteriores(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("descricaoNorm") String descricaoNorm,
            @Param("chaveEstabelecimento") String chaveEstabelecimento,
            @Param("dataRef") java.time.LocalDate dataRef,
            @Param("excluirId") Long excluirId);

    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            JOIN FETCH l.contaContabil c
            LEFT JOIN FETCH l.pessoaRef
            LEFT JOIN FETCH l.clienteEntidade
            LEFT JOIN FETCH l.processo
            WHERE l.etapa <> br.com.vilareal.financeiro.domain.EtapaLancamento.IMPORTADO
              AND l.numeroBanco = :numeroBanco
              AND (l.descricaoNorm = :descricaoNorm OR l.descricaoNorm LIKE CONCAT(:chaveEstabelecimento, '%'))
              AND (:excluirId IS NULL OR l.id <> :excluirId)
              AND l.dataLancamento > :dataRef
            ORDER BY l.dataLancamento ASC
            """)
    List<LancamentoFinanceiroEntity> findRecorrenciaPorNomePosteriores(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("descricaoNorm") String descricaoNorm,
            @Param("chaveEstabelecimento") String chaveEstabelecimento,
            @Param("dataRef") java.time.LocalDate dataRef,
            @Param("excluirId") Long excluirId);

    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            JOIN FETCH l.contaContabil c
            LEFT JOIN FETCH l.pessoaRef
            LEFT JOIN FETCH l.clienteEntidade
            LEFT JOIN FETCH l.processo
            WHERE l.etapa <> br.com.vilareal.financeiro.domain.EtapaLancamento.IMPORTADO
              AND l.numeroBanco = :numeroBanco
              AND l.descricaoNorm = :descricaoNorm
              AND l.valor BETWEEN :valorMin AND :valorMax
              AND (YEAR(l.dataLancamento) * 100 + MONTH(l.dataLancamento)) <> :anoMes
            ORDER BY l.dataLancamento DESC
            """)
    List<LancamentoFinanceiroEntity> findRecorrenciaCandidatos(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("descricaoNorm") String descricaoNorm,
            @Param("valorMin") java.math.BigDecimal valorMin,
            @Param("valorMax") java.math.BigDecimal valorMax,
            @Param("anoMes") int anoMes);

    /**
     * Depósitos já classificados em conta A cuja descrição contém o CPF do pagador
     * (mesma pessoa em lançamentos anteriores).
     */
    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            JOIN FETCH l.contaContabil c
            LEFT JOIN FETCH l.pessoaRef
            LEFT JOIN FETCH l.clienteEntidade
            LEFT JOIN FETCH l.processo
            WHERE l.id <> :excluirId
              AND l.etapa <> :importado
              AND l.pessoaRef IS NOT NULL
              AND UPPER(c.codigo) = 'A'
              AND (
                  REPLACE(REPLACE(REPLACE(UPPER(COALESCE(l.descricao, '')), '.', ''), '-', ''), ' ', '')
                      LIKE CONCAT('%', :cpfDigitos, '%')
                  OR REPLACE(REPLACE(REPLACE(UPPER(COALESCE(l.descricaoDetalhada, '')), '.', ''), '-', ''), ' ', '')
                      LIKE CONCAT('%', :cpfDigitos, '%')
              )
            ORDER BY l.dataLancamento DESC, l.id DESC
            """)
    List<LancamentoFinanceiroEntity> findDepositosIdentificadosPorCpfNoTexto(
            @Param("cpfDigitos") String cpfDigitos,
            @Param("excluirId") Long excluirId,
            @Param("importado") EtapaLancamento importado,
            Pageable pageable);

    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            JOIN FETCH l.contaContabil c
            LEFT JOIN FETCH l.pessoaRef
            LEFT JOIN FETCH l.clienteEntidade
            LEFT JOIN FETCH l.processo
            WHERE l.id <> :excluirId
              AND l.etapa <> :importado
              AND l.pessoaRef IS NOT NULL
              AND UPPER(c.codigo) = 'A'
              AND l.dataLancamento < :dataRef
              AND (
                  REPLACE(REPLACE(REPLACE(UPPER(COALESCE(l.descricao, '')), '.', ''), '-', ''), ' ', '')
                      LIKE CONCAT('%', :cpfDigitos, '%')
                  OR REPLACE(REPLACE(REPLACE(UPPER(COALESCE(l.descricaoDetalhada, '')), '.', ''), '-', ''), ' ', '')
                      LIKE CONCAT('%', :cpfDigitos, '%')
              )
            ORDER BY l.dataLancamento DESC, l.id DESC
            """)
    List<LancamentoFinanceiroEntity> findDepositosIdentificadosPorCpfAnteriores(
            @Param("cpfDigitos") String cpfDigitos,
            @Param("excluirId") Long excluirId,
            @Param("importado") EtapaLancamento importado,
            @Param("dataRef") java.time.LocalDate dataRef,
            Pageable pageable);

    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            JOIN FETCH l.contaContabil c
            LEFT JOIN FETCH l.pessoaRef
            LEFT JOIN FETCH l.clienteEntidade
            LEFT JOIN FETCH l.processo
            WHERE l.id <> :excluirId
              AND l.etapa <> :importado
              AND l.pessoaRef IS NOT NULL
              AND UPPER(c.codigo) = 'A'
              AND l.dataLancamento > :dataRef
              AND (
                  REPLACE(REPLACE(REPLACE(UPPER(COALESCE(l.descricao, '')), '.', ''), '-', ''), ' ', '')
                      LIKE CONCAT('%', :cpfDigitos, '%')
                  OR REPLACE(REPLACE(REPLACE(UPPER(COALESCE(l.descricaoDetalhada, '')), '.', ''), '-', ''), ' ', '')
                      LIKE CONCAT('%', :cpfDigitos, '%')
              )
            ORDER BY l.dataLancamento ASC, l.id ASC
            """)
    List<LancamentoFinanceiroEntity> findDepositosIdentificadosPorCpfPosteriores(
            @Param("cpfDigitos") String cpfDigitos,
            @Param("excluirId") Long excluirId,
            @Param("importado") EtapaLancamento importado,
            @Param("dataRef") java.time.LocalDate dataRef,
            Pageable pageable);

    @EntityGraph(attributePaths = {"contaContabil", "pessoaRef", "clienteEntidade", "processo"})
    List<LancamentoFinanceiroEntity> findAllByGrupoCompensacao(String grupoCompensacao);

    @EntityGraph(attributePaths = {"contaContabil", "pessoaRef", "clienteEntidade", "processo"})
    List<LancamentoFinanceiroEntity> findAllByIdIn(Collection<Long> ids);

    @Query(value = """
            SELECT a.id, b.id, a.numero_banco, b.numero_banco
            FROM financeiro_lancamento a
            """
            + CompensacaoSqlDiaUtil.JOIN_CONTA_E_A
            + """
            INNER JOIN financeiro_lancamento b ON
                """
            + CompensacaoSqlDiaUtil.MESMO_DIA_UTIL_BANCARIO_JOIN_AB
            + """
                 AND a.valor = b.valor
                AND a.natureza <> b.natureza
                AND a.id < b.id
            """
            + CompensacaoSqlDiaUtil.JOIN_CONTA_E_B
            + """
            WHERE a.etapa IN ('IMPORTADO', 'CLASSIFICADO')
              AND b.etapa IN ('IMPORTADO', 'CLASSIFICADO')
              AND (a.grupo_compensacao IS NULL OR a.grupo_compensacao = '')
              AND (b.grupo_compensacao IS NULL OR b.grupo_compensacao = '')
            """
            + CompensacaoSqlDiaUtil.WHERE_CONTA_E_AB
            + """
              AND (:numeroBanco IS NULL OR a.numero_banco = :numeroBanco OR b.numero_banco = :numeroBanco)
              AND (:ano IS NULL OR (YEAR(a.data_lancamento) = :ano AND (:mes IS NULL OR MONTH(a.data_lancamento) = :mes)))
              AND (:apenasInterbancario = false OR a.numero_banco <> b.numero_banco)
              AND (:apenasMesmoBanco = false OR a.numero_banco = b.numero_banco)
              AND (:apenasMesmoDiaCalendario = false OR a.data_lancamento = b.data_lancamento)
              AND (:apenasDiaDivergente = false OR a.data_lancamento <> b.data_lancamento)
            ORDER BY a.data_lancamento DESC
            LIMIT :limit OFFSET :offset
            """, nativeQuery = true)
    List<Object[]> findParesCompensacaoSugeridosIds(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("ano") Integer ano,
            @Param("mes") Integer mes,
            @Param("diasTolerancia") int diasTolerancia,
            @Param("apenasInterbancario") boolean apenasInterbancario,
            @Param("apenasMesmoBanco") boolean apenasMesmoBanco,
            @Param("apenasMesmoDiaCalendario") boolean apenasMesmoDiaCalendario,
            @Param("apenasDiaDivergente") boolean apenasDiaDivergente,
            @Param("limit") int limit,
            @Param("offset") int offset);

    @Query(value = """
            SELECT COUNT(*)
            FROM financeiro_lancamento a
            """
            + CompensacaoSqlDiaUtil.JOIN_CONTA_E_A
            + """
            INNER JOIN financeiro_lancamento b ON
                """
            + CompensacaoSqlDiaUtil.MESMO_DIA_UTIL_BANCARIO_JOIN_AB
            + """
                 AND a.valor = b.valor
                AND a.natureza <> b.natureza
                AND a.id < b.id
            """
            + CompensacaoSqlDiaUtil.JOIN_CONTA_E_B
            + """
            WHERE a.etapa IN ('IMPORTADO', 'CLASSIFICADO')
              AND b.etapa IN ('IMPORTADO', 'CLASSIFICADO')
              AND (a.grupo_compensacao IS NULL OR a.grupo_compensacao = '')
              AND (b.grupo_compensacao IS NULL OR b.grupo_compensacao = '')
            """
            + CompensacaoSqlDiaUtil.WHERE_CONTA_E_AB
            + """
              AND (:numeroBanco IS NULL OR a.numero_banco = :numeroBanco OR b.numero_banco = :numeroBanco)
              AND (:ano IS NULL OR (YEAR(a.data_lancamento) = :ano AND (:mes IS NULL OR MONTH(a.data_lancamento) = :mes)))
              AND (:apenasInterbancario = false OR a.numero_banco <> b.numero_banco)
              AND (:apenasMesmoBanco = false OR a.numero_banco = b.numero_banco)
              AND (:apenasMesmoDiaCalendario = false OR a.data_lancamento = b.data_lancamento)
              AND (:apenasDiaDivergente = false OR a.data_lancamento <> b.data_lancamento)
            """, nativeQuery = true)
    long countParesCompensacaoSugeridos(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("ano") Integer ano,
            @Param("mes") Integer mes,
            @Param("diasTolerancia") int diasTolerancia,
            @Param("apenasInterbancario") boolean apenasInterbancario,
            @Param("apenasMesmoBanco") boolean apenasMesmoBanco,
            @Param("apenasMesmoDiaCalendario") boolean apenasMesmoDiaCalendario,
            @Param("apenasDiaDivergente") boolean apenasDiaDivergente);

    @Query(value = """
            SELECT g.grupo_compensacao,
                   g.soma,
                   g.total
            FROM (
                SELECT grupo_compensacao,
                       SUM(CASE WHEN natureza = 'CREDITO' THEN valor ELSE -valor END) AS soma,
                       COUNT(*) AS total
                FROM financeiro_lancamento
                WHERE grupo_compensacao IS NOT NULL AND grupo_compensacao <> ''
                GROUP BY grupo_compensacao
                HAVING ABS(SUM(CASE WHEN natureza = 'CREDITO' THEN valor ELSE -valor END)) > 0.01
            ) g
            INNER JOIN financeiro_lancamento l ON l.grupo_compensacao = g.grupo_compensacao
            WHERE (:ano IS NULL OR (YEAR(l.data_lancamento) = :ano AND (:mes IS NULL OR MONTH(l.data_lancamento) = :mes)))
              AND (:numeroBanco IS NULL OR l.numero_banco = :numeroBanco)
            GROUP BY g.grupo_compensacao, g.soma, g.total
            ORDER BY ABS(g.soma) DESC
            LIMIT :limit OFFSET :offset
            """, nativeQuery = true)
    List<Object[]> findGruposCompensacaoInconsistentesResumo(
            @Param("ano") Integer ano,
            @Param("mes") Integer mes,
            @Param("numeroBanco") Integer numeroBanco,
            @Param("limit") int limit,
            @Param("offset") int offset);

    @Query(value = """
            SELECT COUNT(*) FROM (
                SELECT g.grupo_compensacao
                FROM (
                    SELECT grupo_compensacao
                    FROM financeiro_lancamento
                    WHERE grupo_compensacao IS NOT NULL AND grupo_compensacao <> ''
                    GROUP BY grupo_compensacao
                    HAVING ABS(SUM(CASE WHEN natureza = 'CREDITO' THEN valor ELSE -valor END)) > 0.01
                ) g
                INNER JOIN financeiro_lancamento l ON l.grupo_compensacao = g.grupo_compensacao
                WHERE (:ano IS NULL OR (YEAR(l.data_lancamento) = :ano AND (:mes IS NULL OR MONTH(l.data_lancamento) = :mes)))
                  AND (:numeroBanco IS NULL OR l.numero_banco = :numeroBanco)
                GROUP BY g.grupo_compensacao
            ) x
            """, nativeQuery = true)
    long countGruposCompensacaoInconsistentes(
            @Param("ano") Integer ano, @Param("mes") Integer mes, @Param("numeroBanco") Integer numeroBanco);

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
            LEFT JOIN FETCH l.pessoaRef
            LEFT JOIN FETCH l.clienteEntidade
            LEFT JOIN FETCH l.processo
            WHERE l.numeroBanco = :numeroBanco
              AND l.dataLancamento BETWEEN :inicio AND :fim
            """)
    List<LancamentoFinanceiroEntity> findByNumeroBancoAndMes(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("inicio") java.time.LocalDate inicio,
            @Param("fim") java.time.LocalDate fim);

    @Query(value = """
            SELECT UPPER(TRIM(c.codigo)) AS codigo,
                   TRIM(c.nome) AS nome,
                   YEAR(l.data_lancamento) AS ano,
                   MONTH(l.data_lancamento) AS mes,
                   SUM(CASE WHEN l.natureza = 'DEBITO' THEN -l.valor ELSE l.valor END) AS saldo,
                   COUNT(l.id) AS qtd
            FROM financeiro_lancamento l
            INNER JOIN financeiro_conta_contabil c ON c.id = l.conta_contabil_id
            WHERE l.data_lancamento >= :dataInicio
              AND l.data_lancamento < :dataFimExclusive
            GROUP BY UPPER(TRIM(c.codigo)), TRIM(c.nome), YEAR(l.data_lancamento), MONTH(l.data_lancamento)
            ORDER BY codigo, ano, mes
            """, nativeQuery = true)
    List<Object[]> resumoMensalPorContaNoPeriodo(
            @Param("dataInicio") LocalDate dataInicio,
            @Param("dataFimExclusive") LocalDate dataFimExclusive);

    @Query(value = """
            SELECT UPPER(TRIM(c.codigo)) AS codigo,
                   COUNT(l.id) AS qtd
            FROM financeiro_lancamento l
            INNER JOIN financeiro_conta_contabil c ON c.id = l.conta_contabil_id
            GROUP BY UPPER(TRIM(c.codigo))
            """, nativeQuery = true)
    List<Object[]> countLancamentosPorContaCodigo();

    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            WHERE l.natureza = :debito
              AND l.dataLancamento BETWEEN :inicio AND :fim
              AND (:numeroBanco IS NULL OR l.numeroBanco = :numeroBanco)
              AND NOT EXISTS (
                  SELECT 1 FROM PagamentoEntity p
                  WHERE p.financeiroLancamento = l
              )
            ORDER BY l.dataLancamento DESC, l.id DESC
            """)
    List<LancamentoFinanceiroEntity> findDebitosNaoVinculadosPagamento(
            @Param("debito") NaturezaLancamento debito,
            @Param("inicio") LocalDate inicio,
            @Param("fim") LocalDate fim,
            @Param("numeroBanco") Integer numeroBanco);

    List<LancamentoFinanceiroEntity> findByDescricaoNormIsNull(Pageable pageable);

    long countByDescricaoNormIsNull();

    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            WHERE l.etapa = br.com.vilareal.financeiro.domain.EtapaLancamento.IMPORTADO
              AND l.descricaoNorm = :descricaoNorm
              AND l.numeroBanco = :numeroBanco
            ORDER BY l.id
            """)
    List<LancamentoFinanceiroEntity> findPendentesPorPadrao(
            @Param("descricaoNorm") String descricaoNorm,
            @Param("numeroBanco") Integer numeroBanco);

    @Query("""
            SELECT COUNT(l) FROM LancamentoFinanceiroEntity l
            WHERE l.etapa = br.com.vilareal.financeiro.domain.EtapaLancamento.CLASSIFICADO
              AND l.descricaoNorm = :descricaoNorm
              AND l.numeroBanco = :numeroBanco
              AND l.contaContabil.id = :contaContabilId
              AND l.clienteEntidade IS NULL
              AND l.processo IS NULL
            """)
    long countParciaisParaCompletarPorPadrao(
            @Param("descricaoNorm") String descricaoNorm,
            @Param("numeroBanco") Integer numeroBanco,
            @Param("contaContabilId") Long contaContabilId);

    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            WHERE l.etapa = br.com.vilareal.financeiro.domain.EtapaLancamento.CLASSIFICADO
              AND l.descricaoNorm = :descricaoNorm
              AND l.numeroBanco = :numeroBanco
              AND l.contaContabil.id = :contaContabilId
              AND l.clienteEntidade IS NULL
              AND l.processo IS NULL
            ORDER BY l.id
            """)
    List<LancamentoFinanceiroEntity> findParciaisParaCompletarPorPadrao(
            @Param("descricaoNorm") String descricaoNorm,
            @Param("numeroBanco") Integer numeroBanco,
            @Param("contaContabilId") Long contaContabilId);

    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            JOIN FETCH l.contaContabil c
            LEFT JOIN FETCH l.clienteEntidade
            LEFT JOIN FETCH l.processo
            WHERE l.etapa <> br.com.vilareal.financeiro.domain.EtapaLancamento.IMPORTADO
              AND UPPER(TRIM(c.codigo)) = 'A'
              AND l.clienteEntidade IS NOT NULL
              AND l.processo IS NOT NULL
              AND l.descricaoNorm IS NOT NULL AND TRIM(l.descricaoNorm) <> ''
              AND (:numeroBanco IS NULL OR l.numeroBanco = :numeroBanco)
            ORDER BY l.dataLancamento DESC, l.id DESC
            """)
    List<LancamentoFinanceiroEntity> findHistoricoVinculadoContaA(@Param("numeroBanco") Integer numeroBanco);

    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            JOIN FETCH l.contaContabil c
            WHERE UPPER(TRIM(c.codigo)) = 'A'
              AND (l.clienteEntidade IS NULL OR l.processo IS NULL)
              AND l.descricaoNorm IS NOT NULL AND TRIM(l.descricaoNorm) <> ''
              AND (:numeroBanco IS NULL OR l.numeroBanco = :numeroBanco)
              AND (:ano IS NULL OR YEAR(l.dataLancamento) = :ano)
              AND (:mes IS NULL OR MONTH(l.dataLancamento) = :mes)
            ORDER BY l.dataLancamento ASC, l.id ASC
            """)
    List<LancamentoFinanceiroEntity> findPendentesSemelhantesEscritorio(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("ano") Integer ano,
            @Param("mes") Integer mes);

    @Query("""
            SELECT l.valor FROM LancamentoFinanceiroEntity l
            INNER JOIN l.contaContabil c
            WHERE l.etapa <> br.com.vilareal.financeiro.domain.EtapaLancamento.IMPORTADO
              AND UPPER(TRIM(c.codigo)) <> 'N'
              AND l.descricaoNorm = :descricaoNorm
              AND l.numeroBanco = :numeroBanco
              AND l.valor IS NOT NULL
            """)
    List<BigDecimal> listarValoresHistoricoPorPadrao(
            @Param("descricaoNorm") String descricaoNorm,
            @Param("numeroBanco") Integer numeroBanco);

    /** Lançamentos de um processo (caixa real do imóvel) — base da reconciliação de locação. */
    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            JOIN FETCH l.contaContabil
            WHERE l.processo.id = :processoId
            ORDER BY l.dataLancamento DESC, l.id DESC
            """)
    List<LancamentoFinanceiroEntity> findByProcessoId(@Param("processoId") Long processoId);

    /**
     * Lançamentos ÓRFÃOS (sem processo) numa janela de datas — candidatos a adoção pela
     * reconciliação de locação. NUNCA traz lançamento que já pertença a um processo.
     */
    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            JOIN FETCH l.contaContabil
            WHERE l.processo IS NULL
              AND l.dataLancamento BETWEEN :inicio AND :fim
            ORDER BY l.dataLancamento DESC, l.id DESC
            """)
    List<LancamentoFinanceiroEntity> findOrfaosNoIntervalo(
            @Param("inicio") LocalDate inicio, @Param("fim") LocalDate fim);
}
