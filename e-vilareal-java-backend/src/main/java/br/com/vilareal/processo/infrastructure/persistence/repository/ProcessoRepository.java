package br.com.vilareal.processo.infrastructure.persistence.repository;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigInteger;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ProcessoRepository extends JpaRepository<ProcessoEntity, Long> {

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

    Page<ProcessoEntity> findByCliente_Id(Long clienteId, Pageable pageable);

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
}
