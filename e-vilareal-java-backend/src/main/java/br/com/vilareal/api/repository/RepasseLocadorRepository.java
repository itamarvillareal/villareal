package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.RepasseLocador;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RepasseLocadorRepository extends JpaRepository<RepasseLocador, Long> {
    List<RepasseLocador> findByContratoIdOrderByCompetenciaMesDesc(Long contratoId);

    Optional<RepasseLocador> findByContratoIdAndCompetenciaMes(Long contratoId, String competenciaMes);
}
