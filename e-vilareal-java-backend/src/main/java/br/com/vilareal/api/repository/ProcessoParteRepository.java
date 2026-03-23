package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.ProcessoParte;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProcessoParteRepository extends JpaRepository<ProcessoParte, Long> {

    @EntityGraph(attributePaths = {"pessoa"})
    List<ProcessoParte> findByProcesso_IdOrderByPoloAscOrdemAsc(Long processoId);
}
