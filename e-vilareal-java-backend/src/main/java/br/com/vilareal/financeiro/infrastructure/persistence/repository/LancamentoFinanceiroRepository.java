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

    @Query(
            """
            SELECT DISTINCT l.dataLancamento FROM LancamentoFinanceiroEntity l
            WHERE l.numeroBanco = :numeroBanco
              AND l.status = 'ATIVO'
            ORDER BY l.dataLancamento DESC
            LIMIT 2
            """)
    List<LocalDate> findDuasUltimasDatasDistintasPorNumeroBanco(@Param("numeroBanco") Integer numeroBanco);

    @Query("""
            SELECT l.numeroLancamento FROM LancamentoFinanceiroEntity l
            WHERE l.numeroBanco = :numeroBanco AND l.numeroLancamento IN :numerosLancamento
            """)
    List<String> findNumeroLancamentoExistentesPorBanco(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("numerosLancamento") Collection<String> numerosLancamento);

    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            WHERE l.numeroLancamento IN :numerosLancamento AND l.status = 'ATIVO'
            """)
    List<LancamentoFinanceiroEntity> findByNumeroLancamentoIn(@Param("numerosLancamento") Collection<String> numerosLancamento);


    @EntityGraph(attributePaths = {"contaContabil", "pessoaRef", "clienteEntidade", "processo"})
    @Override
    List<LancamentoFinanceiroEntity> findAll(Specification<LancamentoFinanceiroEntity> spec, Sort sort);

    @EntityGraph(attributePaths = {"contaContabil", "pessoaRef", "clienteEntidade", "processo", "conferidoPorUsuario"})
    @Override
    Page<LancamentoFinanceiroEntity> findAll(Specification<LancamentoFinanceiroEntity> spec, Pageable pageable);

    @Query("SELECT COUNT(l) FROM LancamentoFinanceiroEntity l WHERE l.processo.id = :processoId AND l.status = 'ATIVO'")
    long countByProcesso_Id(@Param("processoId") Long processoId);


    @Query(value = """
            SELECT COALESCE(SUM(CASE WHEN natureza = 'CREDITO' THEN valor ELSE -valor END), 0)
            FROM financeiro_lancamento
            WHERE processo_id = :processoId
              AND status = 'ATIVO'
            """, nativeQuery = true)
    BigDecimal sumSaldoAssinadoPorProcesso(@Param("processoId") Long processoId);

    @Query(value = """
            SELECT COALESCE(SUM(CASE WHEN natureza = 'CREDITO' THEN valor ELSE -valor END), 0)
            FROM financeiro_lancamento
            WHERE numero_banco = :numeroBanco
              AND status = 'ATIVO'
            """, nativeQuery = true)
    BigDecimal sumSaldoAssinadoPorNumeroBanco(@Param("numeroBanco") Integer numeroBanco);

    @Query(value = """
            SELECT COALESCE(SUM(CASE WHEN natureza = 'CREDITO' THEN valor ELSE -valor END), 0)
            FROM financeiro_lancamento
            WHERE numero_banco = :numeroBanco
              AND status = 'ATIVO'
              AND data_lancamento <= :dataAte
            """, nativeQuery = true)
    BigDecimal sumSaldoAssinadoPorNumeroBancoAteData(
            @Param("numeroBanco") Integer numeroBanco, @Param("dataAte") LocalDate dataAte);

    @Query(value = """
            SELECT COALESCE(SUM(CASE WHEN natureza = 'CREDITO' THEN valor ELSE -valor END), 0)
            FROM financeiro_lancamento
            WHERE numero_banco = :numeroBanco
              AND status = 'ATIVO'
              AND data_lancamento = :dataDia
            """, nativeQuery = true)
    BigDecimal sumSaldoAssinadoPorNumeroBancoNoDia(
            @Param("numeroBanco") Integer numeroBanco, @Param("dataDia") LocalDate dataDia);

    @Query(value = """
            SELECT COUNT(*)
            FROM financeiro_lancamento
            WHERE numero_banco = :numeroBanco
              AND status = 'ATIVO'
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
              AND status = 'ATIVO'
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

    @Query("SELECT COUNT(l) FROM LancamentoFinanceiroEntity l WHERE l.numeroBanco = :numeroBanco AND l.status = 'ATIVO'")
    long countByNumeroBanco(@Param("numeroBanco") Integer numeroBanco);

    @Query("SELECT COUNT(l) FROM LancamentoFinanceiroEntity l WHERE l.numeroBanco = :numeroBanco AND l.status = :status")
    long countByNumeroBancoAndStatus(@Param("numeroBanco") Integer numeroBanco, @Param("status") String status);


    @Query("SELECT l.etapa, COUNT(l) FROM LancamentoFinanceiroEntity l WHERE l.status = 'ATIVO' GROUP BY l.etapa")
    List<Object[]> contarPorEtapa();

    @Query(value = """
            SELECT conta_contabil_id, COUNT(*) AS total
            FROM financeiro_lancamento
            WHERE etapa != 'IMPORTADO'
              AND status = 'ATIVO'
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
              AND l.status = 'ATIVO'
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
              AND l.status = 'ATIVO'
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
              AND l.status = 'ATIVO'
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
              AND l.status = 'ATIVO'
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
              AND l.status = 'ATIVO'
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
              AND l.status = 'ATIVO'
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
              AND l.status = 'ATIVO'
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
              AND l.status = 'ATIVO'
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
    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            WHERE l.grupoCompensacao = :grupoCompensacao AND l.status = 'ATIVO'
            """)
    List<LancamentoFinanceiroEntity> findAllByGrupoCompensacao(@Param("grupoCompensacao") String grupoCompensacao);

    @Query("""
            SELECT COUNT(l) FROM LancamentoFinanceiroEntity l
            WHERE l.grupoCompensacao = :grupoCompensacao AND l.status = 'ATIVO'
            """)
    long countAtivosByGrupoCompensacao(@Param("grupoCompensacao") String grupoCompensacao);


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
              AND a.status = 'ATIVO'
              AND b.status = 'ATIVO'
              AND (a.grupo_compensacao IS NULL OR a.grupo_compensacao = '')
              AND (b.grupo_compensacao IS NULL OR b.grupo_compensacao = '')
            """
            + CompensacaoSqlDiaUtil.WHERE_CONTA_E_AB
            + """
              AND (:filtrarNumeroBancos = false OR a.numero_banco IN (:numeroBancos) OR b.numero_banco IN (:numeroBancos))
              AND (:ano IS NULL OR (YEAR(a.data_lancamento) = :ano AND (:mes IS NULL OR MONTH(a.data_lancamento) = :mes)))
              AND (:apenasInterbancario = false OR a.numero_banco <> b.numero_banco)
              AND (:apenasMesmoBanco = false OR a.numero_banco = b.numero_banco)
              AND (:apenasMesmoDiaCalendario = false OR a.data_lancamento = b.data_lancamento)
              AND (:apenasDiaDivergente = false OR a.data_lancamento <> b.data_lancamento)
            ORDER BY a.data_lancamento DESC
            LIMIT :limit OFFSET :offset
            """, nativeQuery = true)
    List<Object[]> findParesCompensacaoSugeridosIds(
            @Param("filtrarNumeroBancos") boolean filtrarNumeroBancos,
            @Param("numeroBancos") List<Integer> numeroBancos,
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
              AND (:filtrarNumeroBancos = false OR a.numero_banco IN (:numeroBancos) OR b.numero_banco IN (:numeroBancos))
              AND (:ano IS NULL OR (YEAR(a.data_lancamento) = :ano AND (:mes IS NULL OR MONTH(a.data_lancamento) = :mes)))
              AND (:apenasInterbancario = false OR a.numero_banco <> b.numero_banco)
              AND (:apenasMesmoBanco = false OR a.numero_banco = b.numero_banco)
              AND (:apenasMesmoDiaCalendario = false OR a.data_lancamento = b.data_lancamento)
              AND (:apenasDiaDivergente = false OR a.data_lancamento <> b.data_lancamento)
            """, nativeQuery = true)
    long countParesCompensacaoSugeridos(
            @Param("filtrarNumeroBancos") boolean filtrarNumeroBancos,
            @Param("numeroBancos") List<Integer> numeroBancos,
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
                  AND status = 'ATIVO'
                GROUP BY grupo_compensacao
                HAVING ABS(SUM(CASE WHEN natureza = 'CREDITO' THEN valor ELSE -valor END)) > 0.01
            ) g
            INNER JOIN financeiro_lancamento l ON l.grupo_compensacao = g.grupo_compensacao
            WHERE l.status = 'ATIVO'
              AND (:ano IS NULL OR (YEAR(l.data_lancamento) = :ano AND (:mes IS NULL OR MONTH(l.data_lancamento) = :mes)))
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
                      AND status = 'ATIVO'
                    GROUP BY grupo_compensacao
                    HAVING ABS(SUM(CASE WHEN natureza = 'CREDITO' THEN valor ELSE -valor END)) > 0.01
                ) g
                INNER JOIN financeiro_lancamento l ON l.grupo_compensacao = g.grupo_compensacao
                WHERE l.status = 'ATIVO'
                  AND (:ano IS NULL OR (YEAR(l.data_lancamento) = :ano AND (:mes IS NULL OR MONTH(l.data_lancamento) = :mes)))
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
              AND l.status = 'ATIVO'
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
              AND status = 'ATIVO'
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
              AND l.status = 'ATIVO'
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
              AND l.status = 'ATIVO'
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
            WHERE l.status = 'ATIVO'
            GROUP BY UPPER(TRIM(c.codigo))
            """, nativeQuery = true)
    List<Object[]> countLancamentosPorContaCodigo();

    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            WHERE l.status = 'ATIVO'
              AND l.natureza = :debito
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

    @Query("SELECT l FROM LancamentoFinanceiroEntity l WHERE l.descricaoNorm IS NULL AND l.status = 'ATIVO'")
    List<LancamentoFinanceiroEntity> findByDescricaoNormIsNull(Pageable pageable);

    @Query("SELECT COUNT(l) FROM LancamentoFinanceiroEntity l WHERE l.descricaoNorm IS NULL AND l.status = 'ATIVO'")
    long countByDescricaoNormIsNull();


    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            WHERE l.etapa = br.com.vilareal.financeiro.domain.EtapaLancamento.IMPORTADO
              AND l.status = 'ATIVO'
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
              AND l.status = 'ATIVO'
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
              AND l.status = 'ATIVO'
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
              AND l.status = 'ATIVO'
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
            WHERE l.status = 'ATIVO'
              AND UPPER(TRIM(c.codigo)) = 'A'
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
              AND l.status = 'ATIVO'
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
              AND l.status = 'ATIVO'
            ORDER BY l.dataLancamento DESC, l.id DESC
            """)
    List<LancamentoFinanceiroEntity> findByProcessoId(@Param("processoId") Long processoId);

    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            WHERE l.processo.id = :processoId
              AND l.status = 'ATIVO'
              AND l.natureza = br.com.vilareal.financeiro.domain.NaturezaLancamento.CREDITO
              AND NOT EXISTS (
                  SELECT 1 FROM PagamentoEntity p
                  WHERE p.financeiroLancamento = l
              )
            ORDER BY l.dataLancamento ASC, l.id ASC
            """)
    List<LancamentoFinanceiroEntity> findCreditosNaoVinculadosPorProcesso(@Param("processoId") Long processoId);

    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            WHERE l.processo.id = :processoId
              AND l.status = 'ATIVO'
              AND l.natureza = br.com.vilareal.financeiro.domain.NaturezaLancamento.CREDITO
            ORDER BY l.dataLancamento ASC, l.id ASC
            """)
    List<LancamentoFinanceiroEntity> findCreditosPorProcesso(@Param("processoId") Long processoId);

    /**
     * Lançamentos ÓRFÃOS (sem processo) numa janela de datas — candidatos a adoção pela
     * reconciliação de locação. NUNCA traz lançamento que já pertença a um processo.
     */
    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            JOIN FETCH l.contaContabil
            WHERE l.processo IS NULL
              AND l.status = 'ATIVO'
              AND l.dataLancamento BETWEEN :inicio AND :fim
            ORDER BY l.dataLancamento DESC, l.id DESC
            """)
    List<LancamentoFinanceiroEntity> findOrfaosNoIntervalo(
            @Param("inicio") LocalDate inicio, @Param("fim") LocalDate fim);

    /** Créditos Cora no processo, ainda sem vínculo ALUGUEL neste contrato. */
    @Query(
            """
            SELECT l FROM LancamentoFinanceiroEntity l
            WHERE l.numeroBanco = :numeroBanco
              AND l.status = 'ATIVO'
              AND l.natureza = br.com.vilareal.financeiro.domain.NaturezaLancamento.CREDITO
              AND l.dataLancamento BETWEEN :inicio AND :fim
              AND l.processo.id = :processoId
              AND NOT EXISTS (
                  SELECT 1 FROM LocacaoRepasseLancamentoEntity v
                  WHERE v.lancamentoFinanceiro.id = l.id
                    AND v.contratoLocacao.id = :contratoId
                    AND v.papel = br.com.vilareal.imovel.domain.PapelReconciliacao.ALUGUEL
              )
            ORDER BY l.dataLancamento ASC, l.id ASC
            """)
    List<LancamentoFinanceiroEntity> findCreditosCoraSemVinculoAluguelNoContrato(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("processoId") Long processoId,
            @Param("contratoId") Long contratoId,
            @Param("inicio") LocalDate inicio,
            @Param("fim") LocalDate fim);

    /** Créditos órfãos (sem processo) compatíveis com valor e janela — candidatos a honorários. */
    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            WHERE l.processo IS NULL
              AND l.status = 'ATIVO'
              AND l.natureza = br.com.vilareal.financeiro.domain.NaturezaLancamento.CREDITO
              AND l.valor >= :valorMin
              AND l.valor <= :valorMax
              AND l.dataLancamento >= :dataInicio
              AND l.dataLancamento <= :dataFim
              AND NOT EXISTS (
                  SELECT 1 FROM PagamentoEntity p
                  WHERE p.financeiroLancamento = l
              )
            ORDER BY l.dataLancamento DESC, l.id DESC
            """)
    List<LancamentoFinanceiroEntity> findCreditosOrfaosCandidatosHonorarios(
            @Param("valorMin") BigDecimal valorMin,
            @Param("valorMax") BigDecimal valorMax,
            @Param("dataInicio") LocalDate dataInicio,
            @Param("dataFim") LocalDate dataFim);

    /** Última data e quantidade de lançamentos classificados (banco + cartão) por processo. */
    @Query(
            value =
                    """
                    SELECT t.processo_id, MAX(t.ultima_data), SUM(t.qtd)
                    FROM (
                        SELECT l.processo_id,
                               MAX(l.data_lancamento) AS ultima_data,
                               COUNT(*) AS qtd
                        FROM financeiro_lancamento l
                        WHERE l.processo_id IN (:ids)
                          AND l.status = 'ATIVO'
                          AND l.etapa <> 'IMPORTADO'
                        GROUP BY l.processo_id
                        UNION ALL
                        SELECT c.processo_id,
                               MAX(c.data_lancamento),
                               COUNT(*)
                        FROM financeiro_lancamento_cartao c
                        WHERE c.processo_id IN (:ids)
                          AND c.etapa <> 'IMPORTADO'
                        GROUP BY c.processo_id
                    ) t
                    GROUP BY t.processo_id
                    """,
            nativeQuery = true)
    List<Object[]> findAtividadeClassificadaPorProcessoIds(@Param("ids") Collection<Long> ids);

    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            JOIN FETCH l.contaContabil
            LEFT JOIN FETCH l.clienteEntidade
            LEFT JOIN FETCH l.processo
            WHERE l.numeroBanco = :numeroBanco
              AND l.status = 'ATIVO'
              AND l.origem IN :origens
            ORDER BY l.id ASC
            """)
    List<LancamentoFinanceiroEntity> findAtivosPorNumeroBancoEOrigens(
            @Param("numeroBanco") Integer numeroBanco, @Param("origens") Collection<String> origens);

    @Query(value = """
            SELECT COALESCE(SUM(CASE WHEN natureza = 'CREDITO' THEN valor ELSE -valor END), 0)
            FROM financeiro_lancamento
            WHERE grupo_compensacao = :grupo
              AND status = 'ATIVO'
            """, nativeQuery = true)
    BigDecimal sumSaldoAssinadoPorGrupoCompensacaoAtivo(@Param("grupo") String grupo);

    /**
     * Resumo da conta de acerto (CONTA ZERO) por vínculo: cliente prevalece; senão pessoa/imóvel.
     * Colunas: tipo ('C'|'P'|'-'), vinculo_id, total, saldo assinado, pendentes (sem grupo),
     * saldo pendente assinado.
     */
    @Query(value = """
            SELECT
                CASE
                    WHEN fl.cliente_id IS NOT NULL THEN 'C'
                    WHEN fl.pessoa_ref_id IS NOT NULL THEN 'P'
                    ELSE '-'
                END AS tipo,
                COALESCE(fl.cliente_id, fl.pessoa_ref_id) AS vinculo_id,
                COUNT(*) AS total,
                COALESCE(SUM(CASE WHEN fl.natureza = 'CREDITO' THEN fl.valor ELSE -fl.valor END), 0) AS saldo,
                SUM(CASE WHEN fl.grupo_compensacao IS NULL THEN 1 ELSE 0 END) AS pendentes,
                COALESCE(SUM(CASE WHEN fl.grupo_compensacao IS NULL
                    THEN (CASE WHEN fl.natureza = 'CREDITO' THEN fl.valor ELSE -fl.valor END)
                    ELSE 0 END), 0) AS saldo_pendente
            FROM financeiro_lancamento fl
            WHERE fl.numero_banco = :numeroBanco
              AND fl.status = 'ATIVO'
            GROUP BY 1, 2
            ORDER BY ABS(COALESCE(SUM(CASE WHEN fl.grupo_compensacao IS NULL
                THEN (CASE WHEN fl.natureza = 'CREDITO' THEN fl.valor ELSE -fl.valor END)
                ELSE 0 END), 0)) DESC
            """, nativeQuery = true)
    List<Object[]> resumoContaAcertoPorVinculo(@Param("numeroBanco") Integer numeroBanco);

    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            JOIN FETCH l.contaContabil
            WHERE l.grupoCompensacao = :grupo AND l.status = 'ATIVO'
            """)
    List<LancamentoFinanceiroEntity> findAtivosByGrupoCompensacao(@Param("grupo") String grupo);

    /**
     * Visão do acerto agrupada por processo (Etapa 5): somas, pendências e progresso de conferência
     * por proc do recorte cliente/pessoa na conta de acerto. Proc NULL agrupa mensalidades e avulsos.
     * A busca aplica-se ao lançamento (nome do devedor na descrição) ou ao número interno do proc.
     */
    @Query(value = """
            SELECT
                fl.processo_id AS processo_id,
                p.numero_interno AS numero_interno,
                (SELECT GROUP_CONCAT(COALESCE(NULLIF(TRIM(pp.nome_livre), ''), pe.nome)
                        ORDER BY pp.ordem, pp.id SEPARATOR ' x ')
                 FROM processo_parte pp
                 LEFT JOIN pessoa pe ON pe.id = pp.pessoa_id
                 WHERE pp.processo_id = fl.processo_id) AS partes,
                COUNT(*) AS qtd,
                COALESCE(SUM(CASE WHEN fl.natureza = 'CREDITO' THEN fl.valor ELSE 0 END), 0) AS creditos,
                COALESCE(SUM(CASE WHEN fl.natureza = 'DEBITO' THEN fl.valor ELSE 0 END), 0) AS debitos,
                COALESCE(SUM(CASE WHEN fl.natureza = 'CREDITO' THEN fl.valor ELSE -fl.valor END), 0) AS saldo,
                SUM(CASE WHEN fl.grupo_compensacao IS NULL OR fl.grupo_compensacao = '' THEN 1 ELSE 0 END) AS pendentes,
                SUM(CASE WHEN fl.conferido_em IS NULL THEN 1 ELSE 0 END) AS nao_conferidos,
                MAX(fl.conferido_em) AS ultima_conferencia,
                MIN(fl.data_lancamento) AS primeira_data,
                MAX(fl.data_lancamento) AS ultima_data
            FROM financeiro_lancamento fl
            LEFT JOIN processo p ON p.id = fl.processo_id
            WHERE fl.numero_banco = :numeroBanco
              AND fl.status = 'ATIVO'
              AND (:clienteId IS NULL OR fl.cliente_id = :clienteId)
              AND (:pessoaRefId IS NULL OR (fl.pessoa_ref_id = :pessoaRefId AND fl.cliente_id IS NULL))
              AND (:dataInicio IS NULL OR fl.data_lancamento >= :dataInicio)
              AND (:dataFim IS NULL OR fl.data_lancamento <= :dataFim)
              AND (:buscaLike IS NULL
                   OR UPPER(fl.descricao) LIKE :buscaLike
                   OR UPPER(fl.descricao_detalhada) LIKE :buscaLike
                   OR (:buscaNumero IS NOT NULL AND p.numero_interno = :buscaNumero))
            GROUP BY fl.processo_id, p.numero_interno
            ORDER BY (fl.processo_id IS NULL) DESC, p.numero_interno ASC
            """, nativeQuery = true)
    List<Object[]> resumoAcertoPorProcesso(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("clienteId") Long clienteId,
            @Param("pessoaRefId") Long pessoaRefId,
            @Param("dataInicio") LocalDate dataInicio,
            @Param("dataFim") LocalDate dataFim,
            @Param("buscaLike") String buscaLike,
            @Param("buscaNumero") Integer buscaNumero);

    /** Conferência do acerto (V205): marca/desmarca lançamentos por id. */
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE financeiro_lancamento
            SET conferido_em = :quando, conferido_por_usuario_id = :usuarioId
            WHERE id IN (:ids) AND status = 'ATIVO'
            """, nativeQuery = true)
    int atualizarConferenciaPorIds(
            @Param("ids") Collection<Long> ids,
            @Param("quando") java.time.Instant quando,
            @Param("usuarioId") Long usuarioId);

    /**
     * Conferência do acerto em cascata por processo (V205): marca/desmarca todos os lançamentos do
     * proc (ou dos sem proc, quando {@code processoId} nulo) no recorte cliente/pessoa da conta.
     */
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE financeiro_lancamento
            SET conferido_em = :quando, conferido_por_usuario_id = :usuarioId
            WHERE numero_banco = :numeroBanco
              AND status = 'ATIVO'
              AND (:clienteId IS NULL OR cliente_id = :clienteId)
              AND (:pessoaRefId IS NULL OR (pessoa_ref_id = :pessoaRefId AND cliente_id IS NULL))
              AND ((:processoId IS NULL AND processo_id IS NULL) OR processo_id = :processoId)
            """, nativeQuery = true)
    int atualizarConferenciaPorProcesso(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("clienteId") Long clienteId,
            @Param("pessoaRefId") Long pessoaRefId,
            @Param("processoId") Long processoId,
            @Param("quando") java.time.Instant quando,
            @Param("usuarioId") Long usuarioId);

    /** Grupos de compensação distintos do cliente na conta de acerto (para vincular ao fechamento). */
    @Query(value = """
            SELECT DISTINCT grupo_compensacao
            FROM financeiro_lancamento
            WHERE numero_banco = :numeroBanco
              AND cliente_id = :clienteId
              AND status = 'ATIVO'
              AND grupo_compensacao IS NOT NULL AND grupo_compensacao <> ''
            """, nativeQuery = true)
    List<String> findGruposCompensacaoPorClienteEConta(
            @Param("numeroBanco") Integer numeroBanco, @Param("clienteId") Long clienteId);

    /** Saldo pendente (sem grupo) assinado do cliente na conta de acerto. */
    @Query(value = """
            SELECT COALESCE(SUM(CASE WHEN natureza = 'CREDITO' THEN valor ELSE -valor END), 0)
            FROM financeiro_lancamento
            WHERE numero_banco = :numeroBanco
              AND cliente_id = :clienteId
              AND status = 'ATIVO'
              AND (grupo_compensacao IS NULL OR grupo_compensacao = '')
            """, nativeQuery = true)
    BigDecimal sumSaldoPendentePorClienteEConta(
            @Param("numeroBanco") Integer numeroBanco, @Param("clienteId") Long clienteId);

    /**
     * Lançamentos leves do cliente na conta de acerto, em ordem cronológica (Etapa 5c).
     * Colunas: id, data_lancamento, natureza, valor, pendente (1/0), nao_conferido (1/0), processo_id.
     */
    @Query(value = """
            SELECT fl.id, fl.data_lancamento, fl.natureza, fl.valor,
                   CASE WHEN fl.grupo_compensacao IS NULL OR fl.grupo_compensacao = '' THEN 1 ELSE 0 END,
                   CASE WHEN fl.conferido_em IS NULL THEN 1 ELSE 0 END,
                   fl.processo_id
            FROM financeiro_lancamento fl
            WHERE fl.numero_banco = :numeroBanco
              AND fl.status = 'ATIVO'
              AND fl.cliente_id = :clienteId
            ORDER BY fl.data_lancamento ASC, fl.id ASC
            """, nativeQuery = true)
    List<Object[]> findLancamentosLevesAcertoPorCliente(
            @Param("numeroBanco") Integer numeroBanco, @Param("clienteId") Long clienteId);

    @Query(
            """
            SELECT l FROM LancamentoFinanceiroEntity l
            JOIN FETCH l.contaContabil c
            WHERE l.natureza = 'DEBITO'
              AND l.status = 'ATIVO'
              AND c.codigo IN ('A', 'I')
              AND UPPER(l.descricao) LIKE '%CONDOM%'
            ORDER BY l.dataLancamento ASC, l.id ASC
            """)
    List<LancamentoFinanceiroEntity> findDebitosCondominioContasAdministracao();

    @Query(
            """
            SELECT l FROM LancamentoFinanceiroEntity l
            JOIN FETCH l.contaContabil c
            WHERE l.natureza = br.com.vilareal.financeiro.domain.NaturezaLancamento.DEBITO
              AND l.status = 'ATIVO'
              AND c.codigo IN ('A', 'I')
              AND l.dataLancamento BETWEEN :inicio AND :fim
              AND NOT EXISTS (
                  SELECT 1 FROM PagamentoEntity p
                  WHERE p.financeiroLancamento = l
              )
            ORDER BY l.dataLancamento ASC, l.id ASC
            """)
    List<LancamentoFinanceiroEntity> findDebitosCondominioNaoVinculadosPagamento(
            @Param("inicio") java.time.LocalDate inicio, @Param("fim") java.time.LocalDate fim);

    @Query(
            """
            SELECT l.id FROM LancamentoFinanceiroEntity l
            WHERE l.status = 'ATIVO'
              AND l.natureza = br.com.vilareal.financeiro.domain.NaturezaLancamento.CREDITO
              AND l.numeroBanco IN :numerosBanco
              AND l.dataLancamento >= :desde
              AND NOT EXISTS (
                  SELECT 1 FROM PagamentoEntity p
                  WHERE p.financeiroLancamento = l
              )
            ORDER BY l.dataLancamento DESC, l.id DESC
            """)
    List<Long> findCreditosOrfaosPosImportHonorarios(
            @Param("numerosBanco") Collection<Integer> numerosBanco, @Param("desde") LocalDate desde);

    @Query("""
            SELECT l FROM LancamentoFinanceiroEntity l
            WHERE l.numeroBanco = :numeroBanco
              AND l.status = 'ATIVO'
              AND l.dataLancamento BETWEEN :inicio AND :fim
              AND (
                  l.descricao LIKE 'COMPRA -%'
                  OR l.descricao LIKE 'VENDA-%'
                  OR l.descricao LIKE 'IRRF%'
                  OR l.descricao LIKE 'IOF%'
              )
            ORDER BY l.dataLancamento ASC, l.id ASC
            """)
    List<LancamentoFinanceiroEntity> findCandidatosInvestimentoExtrato(
            @Param("numeroBanco") Integer numeroBanco,
            @Param("inicio") LocalDate inicio,
            @Param("fim") LocalDate fim);

    @Query("""
            SELECT COUNT(l) FROM LancamentoFinanceiroEntity l
            WHERE l.numeroBanco IN :numerosBanco
              AND l.status = 'ATIVO'
              AND l.natureza = br.com.vilareal.financeiro.domain.NaturezaLancamento.CREDITO
              AND l.dataLancamento BETWEEN :inicio AND :fim
            """)
    long countCreditosAtivosPorBancosEPeriodo(
            @Param("numerosBanco") Collection<Integer> numerosBanco,
            @Param("inicio") LocalDate inicio,
            @Param("fim") LocalDate fim);
}
