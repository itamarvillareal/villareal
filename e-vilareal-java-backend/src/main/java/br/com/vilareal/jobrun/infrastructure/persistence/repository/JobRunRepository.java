package br.com.vilareal.jobrun.infrastructure.persistence.repository;

import br.com.vilareal.jobrun.domain.JobRunStatus;
import br.com.vilareal.jobrun.infrastructure.persistence.entity.JobRunEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface JobRunRepository extends JpaRepository<JobRunEntity, Long> {

    Optional<JobRunEntity> findFirstByJobNameOrderByStartedAtDescIdDesc(String jobName);

    List<JobRunEntity> findTop10ByJobNameOrderByStartedAtDescIdDesc(String jobName);

    Optional<JobRunEntity> findFirstByJobNameAndStatusOrderByStartedAtDescIdDesc(
            String jobName, JobRunStatus status);

    List<JobRunEntity> findByStatusAndHeartbeatAtBefore(JobRunStatus status, Instant heartbeatBefore);

    Page<JobRunEntity> findAllByOrderByStartedAtDescIdDesc(Pageable pageable);

    Page<JobRunEntity> findByJobNameOrderByStartedAtDescIdDesc(String jobName, Pageable pageable);

    Page<JobRunEntity> findByStatusOrderByStartedAtDescIdDesc(JobRunStatus status, Pageable pageable);

    @Query(
            """
            SELECT r FROM JobRunEntity r
            WHERE (:jobName IS NULL OR r.jobName = :jobName)
              AND (:status IS NULL OR r.status = :status)
            ORDER BY r.startedAt DESC, r.id DESC
            """)
    Page<JobRunEntity> findFiltrado(
            @Param("jobName") String jobName, @Param("status") JobRunStatus status, Pageable pageable);

    /** Backfill consolidado por ano CNJ já concluído com sucesso (evita reexecução a cada deploy). */
    @Query(
            value =
                    """
            SELECT COUNT(*) FROM job_run r
            WHERE r.job_name = :jobName
              AND r.status = 'SUCCESS'
              AND JSON_UNQUOTE(JSON_EXTRACT(r.metadata_json, '$.modo')) = 'ano-cnj-acervo-completo'
              AND CAST(JSON_UNQUOTE(JSON_EXTRACT(r.metadata_json, '$.anoCnj')) AS UNSIGNED) = :ano
            """,
            nativeQuery = true)
    long countConsolidadoAnoBackfillConcluido(@Param("jobName") String jobName, @Param("ano") int ano);

    boolean existsByJobNameAndStatus(String jobName, JobRunStatus status);
}
