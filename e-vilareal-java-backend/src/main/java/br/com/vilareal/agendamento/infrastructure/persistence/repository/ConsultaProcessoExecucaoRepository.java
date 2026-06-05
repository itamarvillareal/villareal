package br.com.vilareal.agendamento.infrastructure.persistence.repository;

import br.com.vilareal.agendamento.infrastructure.persistence.entity.ConsultaProcessoExecucaoEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ConsultaProcessoExecucaoRepository extends JpaRepository<ConsultaProcessoExecucaoEntity, Long> {

    Optional<ConsultaProcessoExecucaoEntity> findFirstByAgendamento_IdOrderByIniciadaEmDesc(Long agendamentoId);

    @Query("""
            SELECT e FROM ConsultaProcessoExecucaoEntity e
            WHERE e.processo.id = :processoId
            ORDER BY e.iniciadaEm DESC
            """)
    Page<ConsultaProcessoExecucaoEntity> findByProcessoIdOrderByIniciadaEmDesc(
            @Param("processoId") Long processoId, Pageable pageable);

    @Query("""
            SELECT e FROM ConsultaProcessoExecucaoEntity e
            WHERE e.agendamento.id = :agendamentoId
            ORDER BY e.iniciadaEm DESC
            """)
    Page<ConsultaProcessoExecucaoEntity> findByAgendamentoIdOrderByIniciadaEmDesc(
            @Param("agendamentoId") Long agendamentoId, Pageable pageable);
}
