package br.com.vilareal.calculo.infrastructure.persistence.repository;

import br.com.vilareal.calculo.infrastructure.persistence.entity.CalculoIndiceMensalEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CalculoIndiceMensalRepository extends JpaRepository<CalculoIndiceMensalEntity, Long> {

    /** Competências em {@code yyyy-MM} ordenam lexicograficamente. */
    List<CalculoIndiceMensalEntity> findByIndiceAndCompetenciaBetween(String indice, String de, String ate);
}
