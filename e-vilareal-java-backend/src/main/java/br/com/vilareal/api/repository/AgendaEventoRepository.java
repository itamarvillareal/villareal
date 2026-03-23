package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.AgendaEvento;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface AgendaEventoRepository extends JpaRepository<AgendaEvento, Long> {
    @EntityGraph(attributePaths = {"usuario"})
    List<AgendaEvento> findByUsuario_IdAndDataEventoBetweenOrderByDataEventoAscHoraEventoAsc(
            Long usuarioId, LocalDate dataInicio, LocalDate dataFim);
}
