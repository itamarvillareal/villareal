package br.com.vilareal.processo.infrastructure.persistence.repository;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigInteger;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ProcessoRepository extends JpaRepository<ProcessoEntity, Long> {

    /**
     * Dedupe da varredura de monitoramento: casa o número REDUZIDO da lista do PROJUDI
     * (sequencial+dv, 9 dígitos) + ano contra o CNJ só-dígitos do acervo. O CNJ em dígitos é
     * NNNNNNN DD AAAA J TR OOOO — os 13 primeiros caracteres são exatamente seq+dv+ano.
     */
    @Query("SELECT p FROM ProcessoEntity p WHERE p.numeroCnjDigitos LIKE CONCAT(:seqDvAno, '%')")
    List<ProcessoEntity> findByCnjSequencialDvAno(@Param("seqDvAno") String seqDvAno);

    /** Match exato pelo CNJ só-dígitos (20) — rede anti-duplicata do cadastro via monitoramento. */
    List<ProcessoEntity> findByNumeroCnjDigitos(String numeroCnjDigitos);

    /** Maior número interno do cliente — sugestão (max+1) para o cadastro via monitoramento. */
    @Query("SELECT MAX(p.numeroInterno) FROM ProcessoEntity p WHERE p.cliente.id = :clienteId")
    Integer findMaxNumeroInternoDoCliente(@Param("clienteId") Long clienteId);

    @Query(
            """
            SELECT p.id FROM ProcessoEntity p
            WHERE p.tramitacao IS NULL OR TRIM(p.tramitacao) = ''
            ORDER BY p.id ASC
            """)
    List<Long> findIdsComTramitacaoVazia();

    @Query(
            """
            SELECT p.id FROM ProcessoEntity p
            WHERE (p.tramitacao IS NULL OR TRIM(p.tramitacao) = '')
              AND p.updatedAt >= :desde
            ORDER BY p.id ASC
            """)
    List<Long> findIdsComTramitacaoVaziaModificadosDesde(@Param("desde") Instant desde);

    @Query(
            """
            SELECT p FROM ProcessoEntity p
            WHERE p.pessoa.id = :pessoaId
              AND LOWER(TRIM(p.unidade)) = LOWER(TRIM(:unidade))
              AND p.unidade IS NOT NULL
              AND TRIM(p.unidade) <> ''
            """)
    Optional<ProcessoEntity> findByPessoa_IdAndUnidade(@Param("pessoaId") Long pessoaId, @Param("unidade") String unidade);

    @Query(
            """
            SELECT DISTINCT p FROM ProcessoEntity p
            WHERE p.pessoa.id = :pid
               OR p.id IN (SELECT pp.processo.id FROM ProcessoParteEntity pp
                           WHERE pp.pessoa IS NOT NULL AND pp.pessoa.id = :pid)
               OR p.id IN (SELECT adv.processoParte.processo.id FROM ProcessoParteAdvogadoEntity adv
                           WHERE adv.advogadoPessoa.id = :pid)
            """)
    List<ProcessoEntity> findAllDistinctVinculadosPessoa(@Param("pid") Long pid);

    /**
     * Pessoas vinculadas a processos (titular ou parte) cujo nome aparece na descrição bancária
     * (tokens separados por {@code %} após normalização). Usado na sugestão do Inbox Financeiro.
     */
    @Query(
            value =
                    """
                    SELECT DISTINCT pe.id, pr.id
                    FROM pessoa pe
                    INNER JOIN processo_parte pp ON pp.pessoa_id = pe.id
                    INNER JOIN processo pr ON pr.id = pp.processo_id
                    WHERE CHAR_LENGTH(TRIM(pe.nome)) >= 10
                      AND :descNorm LIKE CONCAT(
                          '%',
                          REPLACE(REPLACE(REPLACE(LOWER(TRIM(pe.nome)), '.', ''), '-', ''), ' ', '%'),
                          '%')
                    UNION
                    SELECT DISTINCT pe.id, pr.id
                    FROM pessoa pe
                    INNER JOIN processo pr ON pr.pessoa_id = pe.id
                    WHERE CHAR_LENGTH(TRIM(pe.nome)) >= 10
                      AND :descNorm LIKE CONCAT(
                          '%',
                          REPLACE(REPLACE(REPLACE(LOWER(TRIM(pe.nome)), '.', ''), '-', ''), ' ', '%'),
                          '%')
                    LIMIT 25
                    """,
            nativeQuery = true)
    List<Object[]> findPessoaProcessoIdsPorNomeContidoNaDescricao(@Param("descNorm") String descNorm);

    /**
     * Paginação: Spring não deriva bem {@code count} para {@code SELECT DISTINCT} com subqueries —
     * sem {@code countQuery} explícita o runtime pode responder 500 (SQL inválido / count errado).
     */
    @Query(
            value =
                    """
                    SELECT DISTINCT p FROM ProcessoEntity p
                    WHERE p.pessoa.id = :pid
                       OR p.id IN (SELECT pp.processo.id FROM ProcessoParteEntity pp
                                   WHERE pp.pessoa IS NOT NULL AND pp.pessoa.id = :pid)
                       OR p.id IN (SELECT adv.processoParte.processo.id FROM ProcessoParteAdvogadoEntity adv
                                   WHERE adv.advogadoPessoa.id = :pid)
                    """,
            countQuery =
                    """
                    SELECT COUNT(DISTINCT p.id) FROM ProcessoEntity p
                    WHERE p.pessoa.id = :pid
                       OR p.id IN (SELECT pp.processo.id FROM ProcessoParteEntity pp
                                   WHERE pp.pessoa IS NOT NULL AND pp.pessoa.id = :pid)
                       OR p.id IN (SELECT adv.processoParte.processo.id FROM ProcessoParteAdvogadoEntity adv
                                   WHERE adv.advogadoPessoa.id = :pid)
                    """)
    Page<ProcessoEntity> findAllDistinctVinculadosPessoa(@Param("pid") Long pid, Pageable pageable);

    List<ProcessoEntity> findByPessoa_IdOrderByNumeroInternoAsc(Long pessoaId);

    /** Processos em que a pessoa é o titular (cabeçalho {@code pessoa_id}) — listagem por código de cliente. */
    Page<ProcessoEntity> findByPessoa_Id(Long pessoaId, Pageable pageable);

    Optional<ProcessoEntity> findByPessoa_IdAndNumeroInterno(Long pessoaId, Integer numeroInterno);

    Optional<ProcessoEntity> findByCliente_IdAndNumeroInterno(Long clienteId, Integer numeroInterno);

    List<ProcessoEntity> findAllByCliente_IdAndNumeroInternoOrderByIdDesc(Long clienteId, Integer numeroInterno);

    List<ProcessoEntity> findByCliente_IdOrderByNumeroInternoAscIdAsc(Long clienteId);

    @Query(
            """
            SELECT p FROM ProcessoEntity p
            WHERE p.cliente.id = :clienteId
              AND LOWER(TRIM(p.unidade)) = LOWER(TRIM(:unidade))
              AND p.unidade IS NOT NULL
              AND TRIM(p.unidade) <> ''
            """)
    Optional<ProcessoEntity> findByCliente_IdAndUnidade(
            @Param("clienteId") Long clienteId, @Param("unidade") String unidade);

    @Query(
            """
            SELECT p FROM ProcessoEntity p
            WHERE p.cliente.id = :clienteId
              AND LOWER(TRIM(p.unidade)) = LOWER(TRIM(:unidade))
              AND p.unidade IS NOT NULL
              AND TRIM(p.unidade) <> ''
            ORDER BY p.numeroInterno ASC, p.id ASC
            """)
    List<ProcessoEntity> findAllByCliente_IdAndUnidade(
            @Param("clienteId") Long clienteId, @Param("unidade") String unidade);

    /**
     * Primeiro processo «vazio» do cliente: sem unidade, sem RÉU, sem cálculo dim. 0, sem andamento.
     */
    @Query(
            """
            SELECT p FROM ProcessoEntity p
            WHERE p.cliente.id = :clienteId
              AND p.numeroInterno IS NOT NULL
              AND p.numeroInterno >= 1
              AND (p.unidade IS NULL OR TRIM(p.unidade) = '')
              AND NOT EXISTS (
                  SELECT 1 FROM ProcessoParteEntity pp
                  WHERE pp.processo.id = p.id AND UPPER(TRIM(pp.polo)) = 'REU'
              )
              AND NOT EXISTS (
                  SELECT 1 FROM CalculoRodadaEntity cr
                  WHERE cr.codigoCliente = :codigoCliente8
                    AND cr.numeroProcesso = p.numeroInterno
                    AND cr.dimensao = 0
              )
              AND NOT EXISTS (
                  SELECT 1 FROM ProcessoAndamentoEntity pa
                  WHERE pa.processo.id = p.id
              )
            ORDER BY p.numeroInterno ASC, p.id ASC
            """)
    List<ProcessoEntity> findProcessosVaziosPorCliente(
            @Param("clienteId") Long clienteId, @Param("codigoCliente8") String codigoCliente8, Pageable pageable);

    Page<ProcessoEntity> findByCliente_Id(Long clienteId, Pageable pageable);

    long countByCliente_Id(Long clienteId);

    long countByPessoa_Id(Long pessoaId);

    /** Todos os processos com esse nº interno (há um por cliente titular). */
    List<ProcessoEntity> findByNumeroInternoOrderByIdAsc(Integer numeroInterno);

    /** Diagnóstico «Prazo fatal»: cabeçalho do processo com data igual à informada. */
    List<ProcessoEntity> findByPrazoFatal(LocalDate prazoFatal);

    long countByImportacaoId(String importacaoId);

    long deleteByImportacaoId(String importacaoId);

    /**
     * Diagnósticos: igualdade ao parâmetro {@code norm} (só dígitos) após remover pontos, traços, espaços e barras
     * do {@code numero_cnj} — compatível com MySQL/MariaDB sem {@code REGEXP_REPLACE}.
     * <p>O resultado nativo usa {@link BigInteger}; o serviço converte para {@code Long}.</p>
     */
    @Query(
            value =
                    """
                    SELECT id FROM processo
                    WHERE numero_cnj IS NOT NULL
                      AND LENGTH(TRIM(numero_cnj)) > 0
                      AND REPLACE(
                          REPLACE(
                          REPLACE(
                          REPLACE(
                          REPLACE(
                          REPLACE(UPPER(TRIM(numero_cnj)), '.', ''),
                          '-', ''),
                          ' ', ''),
                          '/', ''),
                          CHAR(0x2013 USING utf8mb4), ''),
                          CHAR(0x2014 USING utf8mb4), '') = :norm
                    ORDER BY id ASC
                    LIMIT 50
                    """,
            nativeQuery = true)
    List<BigInteger> findIdsByNumeroCnjNormalizadoDiagnostico(@Param("norm") String norm);

    /**
     * Diagnósticos: o CNJ normalizado (só dígitos, mesma cadeia de {@code REPLACE} que o método de igualdade)
     * contém o fragmento {@code norm} — para buscas com 7–19 dígitos sem o número completo.
     */
    @Query(
            value =
                    """
                    SELECT id FROM processo
                    WHERE numero_cnj IS NOT NULL
                      AND LENGTH(TRIM(numero_cnj)) > 0
                      AND REPLACE(
                          REPLACE(
                          REPLACE(
                          REPLACE(
                          REPLACE(
                          REPLACE(UPPER(TRIM(numero_cnj)), '.', ''),
                          '-', ''),
                          ' ', ''),
                          '/', ''),
                          CHAR(0x2013 USING utf8mb4), ''),
                          CHAR(0x2014 USING utf8mb4), '') LIKE CONCAT('%', :norm, '%')
                    ORDER BY id ASC
                    LIMIT 50
                    """,
            nativeQuery = true)
    List<BigInteger> findIdsByNumeroCnjDigitosContendo(@Param("norm") String norm);

    /**
     * Diagnósticos / vínculo Projudi: CNJ normalizado (só dígitos) começa com {@code norm}
     * — para emails com número interno {@code NNNNNNN.DD} (9 dígitos após normalizar).
     */
    @Query(
            value =
                    """
                    SELECT id FROM processo
                    WHERE numero_cnj IS NOT NULL
                      AND LENGTH(TRIM(numero_cnj)) > 0
                      AND REPLACE(
                          REPLACE(
                          REPLACE(
                          REPLACE(
                          REPLACE(
                          REPLACE(UPPER(TRIM(numero_cnj)), '.', ''),
                          '-', ''),
                          ' ', ''),
                          '/', ''),
                          CHAR(0x2013 USING utf8mb4), ''),
                          CHAR(0x2014 USING utf8mb4), '') LIKE CONCAT(:norm, '%')
                    ORDER BY id ASC
                    LIMIT 50
                    """,
            nativeQuery = true)
    List<BigInteger> findIdsByNumeroCnjDigitosIniciandoCom(@Param("norm") String norm);

    /**
     * Audiências agendadas em {@code processo.audiencia_data} (fonte canônica; agenda espelha via {@code ProcessoAudienciaAgendaSyncService}).
     * Inclusive nas datas {@code inicio} e {@code fim}.
     */
    @Query("""
            SELECT p FROM ProcessoEntity p
            JOIN FETCH p.cliente c
            JOIN FETCH c.pessoa
            JOIN FETCH p.pessoa
            WHERE p.ativo = true
              AND p.audienciaData IS NOT NULL
              AND p.audienciaData >= :inicio
              AND p.audienciaData <= :fim
            ORDER BY p.audienciaData ASC, p.audienciaHora ASC, p.id ASC
            """)
    List<ProcessoEntity> findAudienciasEntre(@Param("inicio") LocalDate inicio, @Param("fim") LocalDate fim);

    @Query("""
            SELECT p FROM ProcessoEntity p
            JOIN FETCH p.cliente c
            JOIN FETCH c.pessoa
            JOIN FETCH p.pessoa
            WHERE p.ativo = true
              AND p.audienciaData IS NOT NULL
            ORDER BY p.audienciaData ASC, p.audienciaHora ASC, p.id ASC
            """)
    List<ProcessoEntity> findAtivosComAudienciaData();

    /** Processos elegíveis à consulta automática PROJUDI-GO (TJGO). */
    @Query("""
            SELECT p FROM ProcessoEntity p
            LEFT JOIN FETCH p.cliente
            LEFT JOIN FETCH p.pessoa
            WHERE p.consultaAutomatica = true
              AND p.ativo = true
              AND p.numeroCnj IS NOT NULL
              AND TRIM(p.numeroCnj) <> ''
              AND UPPER(TRIM(p.uf)) = 'GO'
            ORDER BY p.proximaConsulta ASC, p.id ASC
            """)
    List<ProcessoEntity> findParaConsultaAutomaticaProjudi(Pageable pageable);

    @Query("""
            SELECT p FROM ProcessoEntity p
            LEFT JOIN FETCH p.cliente
            LEFT JOIN FETCH p.pessoa
            LEFT JOIN FETCH p.municipio m
            LEFT JOIN FETCH m.estado
            LEFT JOIN FETCH p.orgaoJulgador o
            LEFT JOIN FETCH o.municipio om
            LEFT JOIN FETCH om.estado
            WHERE p.id = :id
            """)
    Optional<ProcessoEntity> findByIdDetalhado(@Param("id") Long id);

    @Query("""
            SELECT p FROM ProcessoEntity p
            LEFT JOIN FETCH p.cliente
            LEFT JOIN FETCH p.pessoa
            WHERE p.id = :id
            """)
    Optional<ProcessoEntity> findByIdWithClienteAndPessoa(@Param("id") Long id);

    @Query("""
            SELECT p FROM ProcessoEntity p
            LEFT JOIN FETCH p.cliente
            LEFT JOIN FETCH p.pessoa
            LEFT JOIN FETCH p.usuarioResponsavel
            WHERE p.id = :id
            """)
    Optional<ProcessoEntity> findByIdForJuliaEnactment(@Param("id") Long id);

    @Query(
            """
            SELECT p.id FROM ProcessoEntity p
            WHERE p.prazoFatal IS NOT NULL
              AND p.prazoFatal < :hoje
              AND p.ativo = true
              AND EXISTS (SELECT 1 FROM PublicacaoEntity pub WHERE pub.processo.id = p.id)
            ORDER BY p.prazoFatal ASC, p.id ASC
            """)
    List<Long> findIdsComPrazoFatalVencidoComPublicacao(@Param("hoje") LocalDate hoje);

    @Query(
            """
            SELECT p.id FROM ProcessoEntity p
            WHERE p.prazoFatal IS NOT NULL
              AND p.prazoFatal >= :inicio
              AND p.prazoFatal <= :fim
            ORDER BY p.prazoFatal ASC, p.id ASC
            """)
    List<Long> findIdsComPrazoFatalNaJanela(
            @Param("inicio") LocalDate inicio, @Param("fim") LocalDate fim);

    /**
     * Processos com config exportável de monitoramento (backup CSV).
     * Usa EXISTS / UNION indexável — não varre a tabela processo inteira.
     */
    @Query(
            value =
                    """
                    SELECT DISTINCT id FROM (
                        SELECT a.processo_id AS id
                        FROM agendamento_consulta a
                        UNION
                        SELECT d.processo_id AS id
                        FROM notificacao_destinatario d
                        WHERE d.processo_id IS NOT NULL
                        UNION
                        SELECT p.id
                        FROM processo p
                        WHERE p.consulta_periodica_habilitada = 1
                    ) cfg
                    ORDER BY id
                    """,
            nativeQuery = true)
    List<Long> findIdsComConfigConsultaPeriodica();

    @Query(
            """
            SELECT p FROM ProcessoEntity p
            LEFT JOIN FETCH p.cliente c
            LEFT JOIN FETCH c.pessoa
            WHERE p.id IN :ids
            ORDER BY p.id ASC
            """)
    List<ProcessoEntity> findByIdInWithClienteAndPessoa(@Param("ids") Collection<Long> ids);

    /**
     * Localiza processo pelo número CNJ após remover espaços nas extremidades e normalizar para só dígitos.
     * Retorna vazio se não houver exatamente um processo correspondente.
     */
    default Optional<ProcessoEntity> findByNumeroCnj(String numeroCnj) {
        if (numeroCnj == null || numeroCnj.trim().isEmpty()) {
            return Optional.empty();
        }
        String norm = br.com.vilareal.processo.application.ProcessoDiagnosticoNumeroBuscaUtil.normalizarSomenteDigitos(
                numeroCnj.trim());
        if (norm.length() < 7) {
            return Optional.empty();
        }
        List<BigInteger> ids = findIdsByNumeroCnjNormalizadoDiagnostico(norm);
        if (ids.size() != 1) {
            return Optional.empty();
        }
        return findById(ids.getFirst().longValue());
    }

    @Query(
            """
            SELECT p FROM ProcessoEntity p
            WHERE p.fase IS NOT NULL AND TRIM(p.fase) <> ''
            ORDER BY p.id ASC
            """)
    List<ProcessoEntity> findAllComFasePreenchidaOrderByIdAsc();

    @Query(
            """
            SELECT p FROM ProcessoEntity p
            JOIN FETCH p.cliente cc
            JOIN FETCH cc.pessoa cp
            WHERE TRIM(cc.codigoCliente) = :codigoCliente
              AND p.ativo = TRUE
              AND p.unidade IS NOT NULL
              AND TRIM(p.unidade) <> ''
            ORDER BY p.numeroInterno ASC, p.id ASC
            """)
    List<ProcessoEntity> findAtivosComUnidadeByClienteCodigo(@Param("codigoCliente") String codigoCliente);

    @Query(
            """
            SELECT cc.codigoCliente, cp.nome, COUNT(p.id)
            FROM ProcessoEntity p
            JOIN p.cliente cc
            JOIN cc.pessoa cp
            WHERE p.ativo = TRUE
              AND p.unidade IS NOT NULL
              AND TRIM(p.unidade) <> ''
            GROUP BY cc.codigoCliente, cp.nome, cc.id
            ORDER BY cp.nome ASC
            """)
    List<Object[]> findClientesEscritorioComProcessosUnidade();
}
