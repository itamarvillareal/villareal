package br.com.vilareal.publicacao.infrastructure.persistence.repository;

import br.com.vilareal.publicacao.infrastructure.persistence.entity.PublicacaoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface PublicacaoRepository extends JpaRepository<PublicacaoEntity, Long>, JpaSpecificationExecutor<PublicacaoEntity> {

    /** Igualdade exata em {@link PublicacaoEntity#hashConteudo} → coluna {@code hash_conteudo} (UNIQUE). */
    boolean existsByHashConteudo(String hashConteudo);

    /** Detecta email Gmail já importado ({@code arquivo_origem_nome} termina com {@code [messageId]}). */
    boolean existsByArquivoOrigemNomeContaining(String fragment);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM PublicacaoEntity p WHERE p.arquivoOrigemNome LIKE CONCAT('%', :fragment, '%')")
    int deleteByArquivoOrigemNomeContaining(@Param("fragment") String fragment);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
            """
            DELETE FROM PublicacaoEntity p
            WHERE p.origemImportacao = 'MONITORAMENTO'
              AND UPPER(p.numeroProcessoEncontrado) IN :numeros
              AND p.arquivoOrigemNome LIKE CONCAT('%', :messageIdFragment, '%')
            """)
    int deleteFalsosPositivosEmail(
            @Param("numeros") List<String> numerosProcesso,
            @Param("messageIdFragment") String messageIdFragment);

    @Query(
            """
            SELECT CASE WHEN COUNT(p) > 0 THEN true ELSE false END
            FROM PublicacaoEntity p
            WHERE UPPER(p.numeroProcessoEncontrado) = UPPER(:numero)
              AND p.origemImportacao = :origem
              AND (
                    (:data IS NULL AND p.dataPublicacao IS NULL)
                 OR (p.dataPublicacao = :data)
              )
            """)
    boolean existsMesmoProcessoDataOrigem(
            @Param("numero") String numeroProcessoEncontrado,
            @Param("data") LocalDate dataPublicacao,
            @Param("origem") String origemImportacao);

    @Query(
            """
            SELECT p FROM PublicacaoEntity p
            WHERE p.processo.id IN :processoIds
              AND p.origemImportacao = 'PROJUDI'
            """)
    List<PublicacaoEntity> findByProcesso_IdInAndOrigemImportacaoProjudi(
            @Param("processoIds") Collection<Long> processoIds);

    /** Processos distintos com publicação PROJUDI (Movimentações Email) e CNJ completo (≥20 dígitos). */
    @Query(
            """
            SELECT DISTINCT p.processo.id FROM PublicacaoEntity p
            WHERE p.origemImportacao = 'PROJUDI'
              AND p.processo.id IS NOT NULL
              AND LENGTH(
                    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                        UPPER(TRIM(p.numeroProcessoEncontrado)), '.', ''), '-', ''), ' ', ''), '/', ''), CHAR(9), '')
                  ) >= 20
            ORDER BY p.processo.id ASC
            """)
    List<Long> findDistinctProcessoIdsComPublicacaoProjudiCnjCompleto();

    /**
     * Processos distintos com publicação MONITORAMENTO (Publicações Email / Jusbrasil), CNJ completo
     * e segmento TJGO ({@code .8.09.} — Justiça Estadual Goiás).
     */
    @Query(
            """
            SELECT DISTINCT p.processo.id FROM PublicacaoEntity p
            WHERE p.origemImportacao = 'MONITORAMENTO'
              AND p.processo.id IS NOT NULL
              AND UPPER(p.numeroProcessoEncontrado) LIKE '%.8.09.%'
              AND LENGTH(
                    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                        UPPER(TRIM(p.numeroProcessoEncontrado)), '.', ''), '-', ''), ' ', ''), '/', ''), CHAR(9), '')
                  ) >= 20
            ORDER BY p.processo.id ASC
            """)
    List<Long> findDistinctProcessoIdsComPublicacaoMonitoramentoTjgoCnjCompleto();

    /**
     * Processos elegíveis ao robô PROJUDI (backfill): PROJUDI (Movimentações Email) ou
     * MONITORAMENTO TJGO (Publicações Email). TRT e demais tribunais ficam de fora.
     */
    @Query(
            """
            SELECT DISTINCT p.processo.id FROM PublicacaoEntity p
            WHERE p.processo.id IS NOT NULL
              AND LENGTH(
                    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                        UPPER(TRIM(p.numeroProcessoEncontrado)), '.', ''), '-', ''), ' ', ''), '/', ''), CHAR(9), '')
                  ) >= 20
              AND (
                    p.origemImportacao = 'PROJUDI'
                 OR (
                        p.origemImportacao = 'MONITORAMENTO'
                    AND UPPER(p.numeroProcessoEncontrado) LIKE '%.8.09.%'
                    )
              )
            ORDER BY p.processo.id ASC
            """)
    List<Long> findDistinctProcessoIdsElegiveisRoboProjudi();

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM PublicacaoEntity p WHERE p.id IN :ids AND p.origemImportacao = 'PROJUDI'")
    int deleteByIdInAndOrigemImportacaoProjudi(@Param("ids") Collection<Long> ids);

    /**
     * Publicações importadas por e-mail (Gmail) para um CNJ normalizado — exclui linhas criadas
     * pelo robô PROJUDI ({@code arquivo_origem_nome} {@code PROJUDI mov …}).
     */
    @Query(
            """
            SELECT p FROM PublicacaoEntity p
            LEFT JOIN p.processo proc
            WHERE p.emailRecebidoEm IS NOT NULL
              AND (p.arquivoOrigemNome IS NULL OR p.arquivoOrigemNome NOT LIKE 'PROJUDI mov %')
              AND (
                    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                        UPPER(TRIM(p.numeroProcessoEncontrado)), '.', ''), '-', ''), ' ', ''), '/', ''), CHAR(9), '') = :cnjNorm
                 OR (
                        proc.numeroCnj IS NOT NULL
                    AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                        UPPER(TRIM(proc.numeroCnj)), '.', ''), '-', ''), ' ', ''), '/', ''), CHAR(9), '') = :cnjNorm
                    )
              )
            """)
    List<PublicacaoEntity> findImportadasPorEmailPorCnjNormalizado(@Param("cnjNorm") String cnjNorm);
}
