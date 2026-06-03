package br.com.vilareal.jobrun.infrastructure.persistence.entity;

import br.com.vilareal.jobrun.domain.JobRunStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "job_run")
@Getter
@Setter
public class JobRunEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "job_name", nullable = false, length = 80)
    private String jobName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private JobRunStatus status;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "heartbeat_at")
    private Instant heartbeatAt;

    @Column(name = "items_processed", nullable = false)
    private int itemsProcessed;

    @Column(name = "items_failed", nullable = false)
    private int itemsFailed;

    @Column(name = "error_message", length = 2000)
    private String errorMessage;

    @Column(name = "error_stack", columnDefinition = "LONGTEXT")
    private String errorStack;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata_json", columnDefinition = "json")
    private Map<String, Object> metadataJson;

    @Column(name = "host_instance", length = 120)
    private String hostInstance;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;
}
