package br.com.vilareal.agendamento.infrastructure.persistence.repository;

import br.com.vilareal.agendamento.infrastructure.persistence.entity.MovimentacaoMonitoradaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MovimentacaoMonitoradaRepository extends JpaRepository<MovimentacaoMonitoradaEntity, Long> {

    @Query("""
            SELECT m FROM MovimentacaoMonitoradaEntity m
            WHERE m.processo.id = :processoId
            ORDER BY m.numero DESC, m.id DESC
            """)
    List<MovimentacaoMonitoradaEntity> findByProcessoId(@Param("processoId") Long processoId);

    @Query("""
            SELECT CASE WHEN COUNT(m) > 0 THEN true ELSE false END
            FROM MovimentacaoMonitoradaEntity m
            WHERE m.processo.id = :processoId AND m.idMovi = :idMovi
            """)
    boolean existsByProcessoIdAndIdMovi(@Param("processoId") Long processoId, @Param("idMovi") String idMovi);

    @Query("""
            SELECT COUNT(m) FROM MovimentacaoMonitoradaEntity m
            WHERE m.processo.id = :processoId
            """)
    long countByProcessoId(@Param("processoId") Long processoId);
}
