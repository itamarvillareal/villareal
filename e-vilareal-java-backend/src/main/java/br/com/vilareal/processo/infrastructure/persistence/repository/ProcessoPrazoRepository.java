package br.com.vilareal.processo.infrastructure.persistence.repository;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoPrazoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface ProcessoPrazoRepository extends JpaRepository<ProcessoPrazoEntity, Long> {

    List<ProcessoPrazoEntity> findByProcesso_IdOrderByIdAsc(Long processoId);

    /** Prazo fatal gravado na tabela de prazos (ex.: sincronização UI) com {@code data_fim} na data. */
    @Query(
            "SELECT DISTINCT z.processo.id FROM ProcessoPrazoEntity z WHERE z.prazoFatal = true AND z.dataFim = :data")
    List<Long> findDistinctProcessoIdsComPrazoFatalTrueAndDataFim(@Param("data") LocalDate data);
}
