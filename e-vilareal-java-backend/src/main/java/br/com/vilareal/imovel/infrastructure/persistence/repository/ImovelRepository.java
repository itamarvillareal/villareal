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
}
