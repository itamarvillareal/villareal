package br.com.vilareal.orgaojulgador.infrastructure.persistence.repository;

import br.com.vilareal.orgaojulgador.infrastructure.persistence.entity.OrgaoJulgadorEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface OrgaoJulgadorRepository extends JpaRepository<OrgaoJulgadorEntity, Long> {

    @Query("""
            SELECT o FROM OrgaoJulgadorEntity o
            JOIN FETCH o.tribunal t
            LEFT JOIN FETCH o.municipio m
            LEFT JOIN FETCH m.estado e
            WHERE o.ativo = TRUE
              AND (:tribunalId IS NULL OR t.id = :tribunalId)
              AND (:municipioId IS NULL OR m.id = :municipioId)
              AND (:qNorm IS NULL OR :qNorm = '' OR UPPER(o.nome) LIKE CONCAT('%', :qNorm, '%'))
            ORDER BY o.usoCount DESC,
                     CASE WHEN m.id IN (5201108, 5208707) THEN 0 ELSE 1 END,
                     o.favorito DESC,
                     o.nome ASC
            """)
    List<OrgaoJulgadorEntity> buscarAutocomplete(
            @Param("tribunalId") Integer tribunalId,
            @Param("municipioId") Integer municipioId,
            @Param("qNorm") String qNorm,
            Pageable pageable);

    @Query("""
            SELECT o FROM OrgaoJulgadorEntity o
            JOIN FETCH o.tribunal t
            LEFT JOIN FETCH o.municipio m
            LEFT JOIN FETCH m.estado e
            WHERE o.id = :id
            """)
    Optional<OrgaoJulgadorEntity> findByIdDetalhado(@Param("id") Long id);

    Optional<OrgaoJulgadorEntity> findByTribunal_IdAndCodigoCnj(Integer tribunalId, Integer codigoCnj);

    long countByTribunal_IdAndAtivoTrue(Integer tribunalId);

    List<OrgaoJulgadorEntity> findByTribunal_IdAndAtivoTrue(Integer tribunalId);

    @Modifying
    @Query("UPDATE OrgaoJulgadorEntity o SET o.usoCount = o.usoCount + 1 WHERE o.id = :id")
    int incrementarUsoCount(@Param("id") Long id);
}
