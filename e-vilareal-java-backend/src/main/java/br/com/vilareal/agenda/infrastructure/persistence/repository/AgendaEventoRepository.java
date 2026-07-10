package br.com.vilareal.agenda.infrastructure.persistence.repository;

import br.com.vilareal.agenda.infrastructure.persistence.entity.AgendaEventoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

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

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "DELETE FROM agenda_evento", nativeQuery = true)
    int deleteAllInBulk();

    Optional<AgendaEventoEntity> findFirstByUsuario_IdAndProcessoRefAndOrigem(
            Long usuarioId, String processoRef, String origem);

    Optional<AgendaEventoEntity> findFirstByConteudoKey(String conteudoKey);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            DELETE FROM AgendaEventoEntity e
            WHERE e.processoRef = :processoRef AND e.origem = :origem
            """)
    int deleteByProcessoRefAndOrigem(@Param("processoRef") String processoRef, @Param("origem") String origem);

    @Query("""
            SELECT e FROM AgendaEventoEntity e
            JOIN FETCH e.usuario u
            WHERE e.origem = :origem
            ORDER BY e.dataEvento, u.id
            """)
    List<AgendaEventoEntity> findByOrigem(@Param("origem") String origem);

    @Query("""
            SELECT DISTINCT e.processoRef FROM AgendaEventoEntity e
            WHERE e.origem = :origem AND e.processoRef IS NOT NULL
            """)
    List<String> findDistinctProcessoRefByOrigem(@Param("origem") String origem);

    @Query("""
            SELECT DISTINCT e.origem FROM AgendaEventoEntity e
            WHERE e.origem LIKE CONCAT(:prefix, '%')
            ORDER BY e.origem DESC
            """)
    List<String> findDistinctOrigensStartingWith(@Param("prefix") String prefix);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            DELETE FROM AgendaEventoEntity e
            WHERE e.origem = :origem
            """)
    int deleteByOrigem(@Param("origem") String origem);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            DELETE FROM AgendaEventoEntity e
            WHERE e.origem = :origem AND e.dataEvento >= :aPartirDe
            """)
    int deleteByOrigemAndDataEventoGreaterThanEqual(
            @Param("origem") String origem,
            @Param("aPartirDe") LocalDate aPartirDe);
}
