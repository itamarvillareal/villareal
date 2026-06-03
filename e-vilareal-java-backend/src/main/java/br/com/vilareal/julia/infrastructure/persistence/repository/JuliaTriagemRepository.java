package br.com.vilareal.julia.infrastructure.persistence.repository;

import br.com.vilareal.julia.infrastructure.persistence.entity.JuliaTriagemEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface JuliaTriagemRepository extends JpaRepository<JuliaTriagemEntity, Long> {

    Optional<JuliaTriagemEntity> findByPublicacao_Id(Long publicacaoId);

    List<JuliaTriagemEntity> findByProcesso_IdOrderByCriadoEmDescIdDesc(Long processoId);

    @Query(
            """
            SELECT t FROM JuliaTriagemEntity t
            LEFT JOIN FETCH t.publicacao
            WHERE t.processo.id = :processoId
              AND t.criadoEm >= :desde
            ORDER BY t.criadoEm DESC, t.id DESC
            """)
    List<JuliaTriagemEntity> findRecentesPorProcesso(
            @Param("processoId") Long processoId, @Param("desde") java.time.Instant desde);

    @EntityGraph(attributePaths = {"publicacao", "processo", "processo.cliente", "processo.cliente.pessoa"})
    @Query(
            """
            SELECT t FROM JuliaTriagemEntity t
            WHERE (
                (:filtro = 'AGUARDANDO_VOCE' AND (
                    t.statusCaixa = 'AGUARDANDO_VOCE'
                    OR (t.statusCaixa = 'POSTERGADO' AND t.postergarAte IS NOT NULL AND t.postergarAte <= :hoje)
                ))
                OR (:filtro = 'POSTERGADO' AND t.statusCaixa = 'POSTERGADO'
                    AND (t.postergarAte IS NULL OR t.postergarAte > :hoje))
                OR (:filtro = 'CONCLUIDO' AND t.statusCaixa = 'CONCLUIDO')
            )
            """)
    List<JuliaTriagemEntity> findForCaixa(@Param("filtro") String filtro, @Param("hoje") LocalDate hoje);
}
