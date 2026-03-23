package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.ProcessoPrazo;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProcessoPrazoRepository extends JpaRepository<ProcessoPrazo, Long> {

    @EntityGraph(attributePaths = {"andamento"})
    List<ProcessoPrazo> findByProcesso_IdOrderByDataFimAsc(Long processoId);

    @EntityGraph(attributePaths = {"andamento", "processo"})
    Optional<ProcessoPrazo> findByIdAndProcesso_Id(Long id, Long processoId);
}
