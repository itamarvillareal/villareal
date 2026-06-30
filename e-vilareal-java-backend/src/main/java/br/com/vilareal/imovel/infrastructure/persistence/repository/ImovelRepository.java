package br.com.vilareal.imovel.infrastructure.persistence.repository;

import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ImovelRepository extends JpaRepository<ImovelEntity, Long> {

    List<ImovelEntity> findAllByOrderByIdAsc();

    Optional<ImovelEntity> findByNumeroPlanilha(Integer numeroPlanilha);

    Optional<ImovelEntity> findByCliente_IdAndNumeroPlanilha(Long clienteId, Integer numeroPlanilha);

    Optional<ImovelEntity> findFirstByProcesso_IdOrderByIdAsc(Long processoId);

    /**
     * Imóveis com o nº da planilha ou marcados na importação Proc/0.89.1 (observações «planilha legado N»).
     */
    @Query(
            """
            SELECT DISTINCT i FROM ImovelEntity i
            LEFT JOIN FETCH i.processo p
            LEFT JOIN FETCH p.pessoa
            LEFT JOIN FETCH i.pessoa
            WHERE i.numeroPlanilha = :numero
               OR (i.observacoes IS NOT NULL AND LOWER(i.observacoes) LIKE LOWER(CONCAT('%planilha legado ', :numero, '%')))
            ORDER BY i.id ASC
            """)
    List<ImovelEntity> findAllPorNumeroPlanilhaLegado(@Param("numero") Integer numero);

    @Query(
            """
            SELECT im.condominio, COUNT(im)
            FROM ImovelEntity im
            WHERE im.ativo = TRUE
              AND im.condominio IS NOT NULL
              AND TRIM(im.condominio) <> ''
            GROUP BY im.condominio
            ORDER BY im.condominio ASC
            """)
    List<Object[]> findCondominiosDistinctComContagem();

    @Query(
            """
            SELECT im FROM ImovelEntity im
            LEFT JOIN FETCH im.cliente c
            LEFT JOIN FETCH c.pessoa
            LEFT JOIN FETCH im.processo proc
            WHERE im.ativo = TRUE
              AND (:condominio IS NULL OR LOWER(TRIM(im.condominio)) = LOWER(TRIM(:condominio)))
              AND (:clienteId IS NULL OR c.id = :clienteId)
            ORDER BY im.condominio ASC, im.unidade ASC, im.id ASC
            """)
    List<ImovelEntity> findForCobrancaPreview(
            @Param("condominio") String condominio, @Param("clienteId") Long clienteId);
}
