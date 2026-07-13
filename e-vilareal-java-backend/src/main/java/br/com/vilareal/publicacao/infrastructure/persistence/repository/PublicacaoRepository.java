package br.com.vilareal.publicacao.infrastructure.persistence.repository;

import br.com.vilareal.publicacao.infrastructure.persistence.entity.PublicacaoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface PublicacaoRepository extends JpaRepository<PublicacaoEntity, Long>, JpaSpecificationExecutor<PublicacaoEntity> {

    /** Igualdade exata em {@link PublicacaoEntity#hashConteudo} → coluna {@code hash_conteudo} (UNIQUE). */
    boolean existsByHashConteudo(String hashConteudo);

    /** Detecta email Gmail já importado ({@code arquivo_origem_nome} termina com {@code [messageId]}). */
    boolean existsByArquivoOrigemNomeContaining(String fragment);

    boolean existsByArquivoOrigemNomeContainingAndOrigemImportacaoIn(
            String fragment, Collection<String> origensImportacao);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
            """
            UPDATE PublicacaoEntity p
            SET p.gmailCaixaOrdem = :ordem
            WHERE p.arquivoOrigemNome LIKE CONCAT('%[', :messageId, ']%')
              AND p.origemImportacao IN :origens
            """)
    int updateGmailCaixaOrdemForMessage(
            @Param("messageId") String messageId,
            @Param("ordem") int ordem,
            @Param("origens") Collection<String> origens);

    /**
     * {@code emailRecebidoEm} nunca regride: PUSH TRT em thread antiga tem Date/internalDate
     * defasados no Gmail; a entrada já corrigida (ex.: importação em 12/07) deve prevalecer.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
            """
            UPDATE PublicacaoEntity p
            SET p.gmailCaixaOrdem = :ordem,
                p.emailRecebidoEm = CASE
                    WHEN p.emailRecebidoEm IS NULL OR p.emailRecebidoEm < :emailRecebidoEm
                        THEN :emailRecebidoEm
                    ELSE p.emailRecebidoEm
                END
            WHERE p.arquivoOrigemNome LIKE CONCAT('%[', :messageId, ']%')
              AND p.origemImportacao IN :origens
            """)
    int updateGmailCaixaOrdemAndEmailRecebidoForMessage(
            @Param("messageId") String messageId,
            @Param("ordem") int ordem,
            @Param("emailRecebidoEm") Instant emailRecebidoEm,
            @Param("origens") Collection<String> origens);

    /** Pares (id, arquivoOrigemNome) para montar o índice messageId → publicações. */
    @Query(
            """
            SELECT p.id, p.arquivoOrigemNome
            FROM PublicacaoEntity p
            WHERE p.origemImportacao IN :origens
              AND p.arquivoOrigemNome IS NOT NULL
            """)
    List<Object[]> findIdAndArquivoOrigemNomeByOrigemImportacaoIn(@Param("origens") Collection<String> origens);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE PublicacaoEntity p SET p.gmailCaixaOrdem = NULL WHERE p.origemImportacao IN :origens")
    int clearGmailCaixaOrdem(@Param("origens") Collection<String> origens);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE PublicacaoEntity p SET p.gmailCaixaOrdem = :ordem WHERE p.id IN :ids")
    int updateGmailCaixaOrdemForIds(@Param("ids") Collection<Long> ids, @Param("ordem") int ordem);

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
     * Processos com movimentação PROJUDI vinculada ({@code processo_id}) e e-mail recebido desde
     * {@code emailRecebidoDesde} — janela do pipeline automático (ex.: últimos 7 dias).
     */
    @Query(
            """
            SELECT DISTINCT p.processo.id FROM PublicacaoEntity p
            WHERE p.origemImportacao = 'PROJUDI'
              AND p.processo.id IS NOT NULL
              AND p.emailRecebidoEm IS NOT NULL
              AND p.emailRecebidoEm >= :emailRecebidoDesde
            ORDER BY p.processo.id ASC
            """)
    List<Long> findDistinctProcessoIdsProjudiVinculadosComEmailRecebidoDesde(
            @Param("emailRecebidoDesde") Instant emailRecebidoDesde);

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

    @Query(
            """
            SELECT p FROM PublicacaoEntity p
            WHERE p.origemImportacao = 'TRT'
              AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                    UPPER(TRIM(p.numeroProcessoEncontrado)), '.', ''), '-', ''), ' ', ''), '/', ''), CHAR(9), '') = :cnjNorm
            ORDER BY p.createdAt DESC, p.id DESC
            """)
    List<PublicacaoEntity> findPublicacoesTrtPorCnjNormalizado(
            @Param("cnjNorm") String cnjNorm, org.springframework.data.domain.Pageable pageable);

    @Query(
            """
            SELECT DISTINCT p.processo.id FROM PublicacaoEntity p
            WHERE p.processo.id IN :processoIds
              AND p.origemImportacao = 'PROJUDI'
            """)
    List<Long> findDistinctProcessoIdsComOrigemProjudi(@Param("processoIds") Collection<Long> processoIds);

    @Query(
            """
            SELECT DISTINCT p.processo.id FROM PublicacaoEntity p
            WHERE p.processo.id IN :processoIds
              AND p.origemImportacao = 'TRT'
              AND UPPER(p.numeroProcessoEncontrado) LIKE '%.5.18.%'
            """)
    List<Long> findDistinctProcessoIdsComOrigemTrt18(@Param("processoIds") Collection<Long> processoIds);

    @Query(
            """
            SELECT DISTINCT p.processo.id FROM PublicacaoEntity p
            WHERE p.processo.id IN :processoIds
              AND p.origemImportacao = 'MONITORAMENTO'
            """)
    List<Long> findDistinctProcessoIdsComOrigemMonitoramento(@Param("processoIds") Collection<Long> processoIds);

    @Query(
            """
            SELECT p.processo.id, p.numeroProcessoEncontrado FROM PublicacaoEntity p
            WHERE p.processo.id IN :processoIds
              AND p.origemImportacao = 'MONITORAMENTO'
              AND p.numeroProcessoEncontrado IS NOT NULL
              AND TRIM(p.numeroProcessoEncontrado) <> ''
            """)
    List<Object[]> findMonitoramentoCnjPorProcessoIds(@Param("processoIds") Collection<Long> processoIds);

    @Query("SELECT p.processo.id FROM PublicacaoEntity p WHERE p.id = :publicacaoId")
    java.util.Optional<Long> findProcessoIdByPublicacaoId(@Param("publicacaoId") Long publicacaoId);

    java.util.Optional<PublicacaoEntity> findTop1ByProcesso_IdOrderByCreatedAtDescIdDesc(Long processoId);
}
