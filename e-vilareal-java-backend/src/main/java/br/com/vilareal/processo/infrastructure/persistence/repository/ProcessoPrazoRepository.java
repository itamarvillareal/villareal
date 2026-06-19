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

    /** Dedup genérico: prazo fatal já registrado na data (qualquer origem). */
    @Query(
            "SELECT COUNT(z) FROM ProcessoPrazoEntity z WHERE z.processo.id = :processoId "
                    + "AND z.dataFim = :dataFim AND z.prazoFatal = true")
    long countPrazoFatalNaData(@Param("processoId") Long processoId, @Param("dataFim") LocalDate dataFim);

    /** Dedup A2b: prazo fatal da Júlia (via {@code andamento.origem}) já registrado na data. */
    @Query(
            "SELECT COUNT(z) FROM ProcessoPrazoEntity z WHERE z.processo.id = :processoId "
                    + "AND z.dataFim = :dataFim AND z.prazoFatal = true AND z.andamento.origem = :origem")
    long countPrazoFatalDaJuliaNaData(
            @Param("processoId") Long processoId,
            @Param("dataFim") LocalDate dataFim,
            @Param("origem") String origem);
}
