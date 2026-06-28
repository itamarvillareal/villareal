package br.com.vilareal.localidade.infrastructure.persistence.repository;

import br.com.vilareal.localidade.infrastructure.persistence.entity.MunicipioEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MunicipioRepository extends JpaRepository<MunicipioEntity, Integer> {

    @Query("""
            SELECT m FROM MunicipioEntity m
            JOIN FETCH m.estado e
            WHERE (:ufSigla IS NULL OR UPPER(e.sigla) = UPPER(:ufSigla))
              AND (:ufId IS NULL OR e.id = :ufId)
              AND (:qNorm IS NULL OR :qNorm = '' OR m.nomeNormalizado LIKE CONCAT(:qNorm, '%'))
            ORDER BY m.favorito DESC, m.usoCount DESC, m.nome ASC
            """)
    List<MunicipioEntity> buscarAutocomplete(
            @Param("ufSigla") String ufSigla,
            @Param("ufId") Integer ufId,
            @Param("qNorm") String qNorm,
            Pageable pageable);

    @Query("""
            SELECT m FROM MunicipioEntity m
            JOIN FETCH m.estado e
            WHERE m.nomeNormalizado = :nomeNorm
              AND (:ufSigla IS NULL OR UPPER(e.sigla) = UPPER(:ufSigla))
            """)
    List<MunicipioEntity> findByNomeNormalizadoAndUf(
            @Param("nomeNorm") String nomeNorm,
            @Param("ufSigla") String ufSigla);

    Optional<MunicipioEntity> findById(Integer id);

    @Modifying
    @Query("UPDATE MunicipioEntity m SET m.usoCount = m.usoCount + 1 WHERE m.id = :id")
    int incrementarUsoCount(@Param("id") Integer id);
}
