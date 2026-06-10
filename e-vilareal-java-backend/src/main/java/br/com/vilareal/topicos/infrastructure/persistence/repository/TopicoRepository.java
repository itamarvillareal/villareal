package br.com.vilareal.topicos.infrastructure.persistence.repository;

import br.com.vilareal.topicos.infrastructure.persistence.entity.TopicoEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TopicoRepository extends JpaRepository<TopicoEntity, Long> {

    Page<TopicoEntity> findByAtivoTrueOrderByCategoriaAscSubcategoriaAscOrdemAscNomeAsc(Pageable pageable);

    List<TopicoEntity> findByAtivoTrueAndCategoriaIgnoreCaseOrderBySubcategoriaAscOrdemAscNomeAsc(String categoria);

    Optional<TopicoEntity> findByChaveNavegacao(String chaveNavegacao);

    Optional<TopicoEntity> findByChaveNavegacaoAndBlocoIndice(String chaveNavegacao, Integer blocoIndice);

    List<TopicoEntity> findByChaveNavegacaoAndAtivoTrueAndConteudoHtmlIsNotNullOrderByBlocoIndiceAsc(
            String chaveNavegacao);

    @Query(
            """
            SELECT DISTINCT t.categoria FROM TopicoEntity t
            WHERE t.ativo = TRUE
            ORDER BY t.categoria ASC
            """)
    List<String> findDistinctCategoriasAtivas();

    @Query(
            """
            SELECT DISTINCT t.subcategoria FROM TopicoEntity t
            WHERE t.ativo = TRUE AND LOWER(t.categoria) = LOWER(:categoria) AND t.subcategoria IS NOT NULL
            ORDER BY t.subcategoria ASC
            """)
    List<String> findDistinctSubcategoriasByCategoria(@Param("categoria") String categoria);

    @Query(
            """
            SELECT t FROM TopicoEntity t
            WHERE t.ativo = TRUE
              AND (
                LOWER(t.nome) LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(t.categoria) LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(COALESCE(t.subcategoria, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(t.chaveNavegacao) LIKE LOWER(CONCAT('%', :q, '%'))
              )
            ORDER BY t.categoria ASC, t.subcategoria ASC, t.ordem ASC, t.nome ASC
            """)
    List<TopicoEntity> searchAtivos(@Param("q") String q);

    List<TopicoEntity> findByIdInAndAtivoTrue(Collection<Long> ids);

    @Query(
            """
            SELECT t FROM TopicoEntity t
            WHERE LOWER(COALESCE(t.subcategoria, '')) LIKE LOWER(CONCAT('%', :filtro, '%'))
               OR LOWER(t.chaveNavegacao) LIKE LOWER(CONCAT('%', :filtro, '%'))
            ORDER BY t.chaveNavegacao ASC, t.blocoIndice ASC
            """)
    List<TopicoEntity> findByFiltroSubcategoriaOuChave(@Param("filtro") String filtro);
}
