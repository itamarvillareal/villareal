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

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM PublicacaoEntity p WHERE p.id IN :ids AND p.origemImportacao = 'PROJUDI'")
    int deleteByIdInAndOrigemImportacaoProjudi(@Param("ids") Collection<Long> ids);
}
