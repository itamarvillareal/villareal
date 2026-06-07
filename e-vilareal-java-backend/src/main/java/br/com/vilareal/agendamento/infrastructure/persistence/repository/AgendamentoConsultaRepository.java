package br.com.vilareal.agendamento.infrastructure.persistence.repository;

import br.com.vilareal.agendamento.infrastructure.persistence.entity.AgendamentoConsultaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AgendamentoConsultaRepository extends JpaRepository<AgendamentoConsultaEntity, Long> {

    @Query("""
            SELECT a FROM AgendamentoConsultaEntity a
            JOIN FETCH a.processo p
            LEFT JOIN FETCH p.cliente c
            LEFT JOIN FETCH c.pessoa
            WHERE a.id = :id
            """)
    Optional<AgendamentoConsultaEntity> findByIdWithProcesso(@Param("id") Long id);

    @Query("""
            SELECT a FROM AgendamentoConsultaEntity a
            JOIN FETCH a.processo p
            LEFT JOIN FETCH p.cliente
            WHERE a.processo.id = :processoId
            ORDER BY a.prioridade DESC, a.id DESC
            """)
    List<AgendamentoConsultaEntity> findByProcessoId(@Param("processoId") Long processoId);

    @Query("""
            SELECT a FROM AgendamentoConsultaEntity a
            JOIN FETCH a.processo p
            WHERE p.id IN :processoIds
            ORDER BY p.id ASC, a.prioridade DESC, a.id DESC
            """)
    List<AgendamentoConsultaEntity> findByProcessoIdIn(@Param("processoIds") Collection<Long> processoIds);

    @Query("""
            SELECT a FROM AgendamentoConsultaEntity a
            JOIN FETCH a.processo p
            LEFT JOIN FETCH p.cliente c
            LEFT JOIN FETCH c.pessoa
            WHERE a.ativo = true
              AND p.consultaPeriodicaHabilitada = true
            ORDER BY a.prioridade DESC, a.proximaExecucao ASC
            """)
    List<AgendamentoConsultaEntity> findByAtivoTrueComProcesso();

    @Query("""
            SELECT a FROM AgendamentoConsultaEntity a
            WHERE a.ativo = true
              AND a.proximaExecucao <= :agora
              AND (a.validoAte IS NULL OR a.validoAte >= :agora)
            ORDER BY a.prioridade DESC, a.proximaExecucao ASC
            """)
    List<AgendamentoConsultaEntity> findVencidos(@Param("agora") LocalDateTime agora);

    @Query("""
            SELECT a FROM AgendamentoConsultaEntity a
            JOIN FETCH a.processo p
            WHERE a.ativo = true
              AND p.consultaPeriodicaHabilitada = true
              AND a.proximaExecucao <= :agora
              AND (a.validoAte IS NULL OR a.validoAte >= :agora)
            ORDER BY a.prioridade DESC, a.proximaExecucao ASC
            """)
    List<AgendamentoConsultaEntity> findVencidosComProcesso(@Param("agora") LocalDateTime agora);
}
