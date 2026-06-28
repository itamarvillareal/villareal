package br.com.vilareal.orgaojulgador.infrastructure.persistence.repository;

import br.com.vilareal.orgaojulgador.infrastructure.persistence.entity.TribunalEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface TribunalRepository extends JpaRepository<TribunalEntity, Integer> {

    @Query("SELECT t FROM TribunalEntity t LEFT JOIN FETCH t.estado ORDER BY t.sigla ASC")
    List<TribunalEntity> findAllByOrderBySiglaAsc();

    @Query("SELECT t FROM TribunalEntity t LEFT JOIN FETCH t.estado WHERE t.ativo = TRUE ORDER BY t.sigla ASC")
    List<TribunalEntity> findByAtivoTrueOrderBySiglaAsc();

    Optional<TribunalEntity> findBySigla(String sigla);
}
