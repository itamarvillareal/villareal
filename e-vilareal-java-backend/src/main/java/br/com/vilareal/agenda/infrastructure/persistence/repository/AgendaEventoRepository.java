package br.com.vilareal.agenda.infrastructure.persistence.repository;

import br.com.vilareal.agenda.infrastructure.persistence.entity.AgendaEventoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface AgendaEventoRepository extends JpaRepository<AgendaEventoEntity, Long> {

    @Query("""
            SELECT e FROM AgendaEventoEntity e
            JOIN FETCH e.usuario u
            WHERE u.id = :usuarioId
              AND e.dataEvento >= :inicio
              AND e.dataEvento <= :fim
            """)
    List<AgendaEventoEntity> findByUsuarioAndPeriodo(
            @Param("usuarioId") Long usuarioId,
            @Param("inicio") LocalDate inicio,
            @Param("fim") LocalDate fim);

    @Query("""
            SELECT e FROM AgendaEventoEntity e
            JOIN FETCH e.usuario u
            WHERE e.dataEvento >= :inicio
              AND e.dataEvento <= :fim
            """)
    List<AgendaEventoEntity> findByPeriodoTodosUsuarios(
            @Param("inicio") LocalDate inicio,
            @Param("fim") LocalDate fim);
}
