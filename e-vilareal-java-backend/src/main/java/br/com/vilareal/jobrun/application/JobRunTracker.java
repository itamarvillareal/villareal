package br.com.vilareal.jobrun.application;

import br.com.vilareal.jobrun.domain.JobRunStatus;
import br.com.vilareal.jobrun.infrastructure.persistence.entity.JobRunEntity;
import br.com.vilareal.jobrun.infrastructure.persistence.repository.JobRunRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import java.util.function.Supplier;

/**
 * Wrapper reutilizável para registrar execuções de jobs. Falhas ao persistir log não interrompem o job.
 */
@Service
public class JobRunTracker {

    private static final Logger log = LoggerFactory.getLogger(JobRunTracker.class);

    private final JobRunRepository repository;
    private final JobRunProperties properties;

    public JobRunTracker(JobRunRepository repository, JobRunProperties properties) {
        this.repository = repository;
        this.properties = properties;
    }

    public void runTrackedJobVoid(String jobName, Consumer<JobRunContext> fn) {
        runTrackedJob(jobName, ctx -> {
            fn.accept(ctx);
            return null;
        });
    }

    public <T> T runTrackedJob(String jobName, FunctionWithContext<T> fn) {
        Long runId = iniciarRun(jobName);
        JobRunContext ctx = new JobRunContext(runId, this);
        Instant started = Instant.now();
        try {
            T result = fn.apply(ctx);
            finalizarSucesso(runId, started, ctx);
            return result;
        } catch (Exception ex) {
            finalizarErro(runId, started, ctx, ex);
            throw ex;
        }
    }

    @FunctionalInterface
    public interface FunctionWithContext<T> {
        T apply(JobRunContext ctx);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    Long iniciarRun(String jobName) {
        try {
            JobRunEntity e = new JobRunEntity();
            Instant now = Instant.now();
            e.setJobName(jobName);
            e.setStatus(JobRunStatus.RUNNING);
            e.setStartedAt(now);
            e.setHeartbeatAt(now);
            e.setHostInstance(properties.getInstanceId());
            e.setItemsProcessed(0);
            e.setItemsFailed(0);
            return repository.save(e).getId();
        } catch (Exception ex) {
            log.error("job_run: falha ao iniciar registro job={}: {}", jobName, ex.getMessage());
            return -1L;
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void heartbeat(Long runId) {
        if (runId == null || runId < 1) {
            return;
        }
        try {
            repository.findById(runId).ifPresent(e -> {
                if (e.getStatus() == JobRunStatus.RUNNING) {
                    e.setHeartbeatAt(Instant.now());
                    repository.save(e);
                }
            });
        } catch (Exception ex) {
            log.warn("job_run: falha no heartbeat runId={}: {}", runId, ex.getMessage());
        }
    }

    <T> T executarComHeartbeatPeriodico(Long runId, Supplier<T> bloco) {
        if (runId == null || runId < 1) {
            return bloco.get();
        }
        int intervalSec = Math.max(10, properties.getHeartbeatIntervalSeconds());
        AtomicReference<T> resultado = new AtomicReference<>();
        AtomicReference<RuntimeException> erro = new AtomicReference<>();
        Thread worker =
                new Thread(
                        () -> {
                            try {
                                resultado.set(bloco.get());
                            } catch (RuntimeException ex) {
                                erro.set(ex);
                            } catch (Exception ex) {
                                erro.set(new RuntimeException(ex));
                            }
                        },
                        "job-run-" + runId);
        worker.start();
        while (worker.isAlive()) {
            heartbeat(runId);
            try {
                worker.join(intervalSec * 1000L);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        if (erro.get() != null) {
            throw erro.get();
        }
        return resultado.get();
    }

    private void finalizarSucesso(Long runId, Instant started, JobRunContext ctx) {
        if (runId == null || runId < 1) {
            return;
        }
        try {
            repository.findById(runId).ifPresent(e -> {
                Instant finished = Instant.now();
                e.setStatus(JobRunStatus.SUCCESS);
                e.setFinishedAt(finished);
                e.setDurationMs(Duration.between(started, finished).toMillis());
                e.setHeartbeatAt(finished);
                e.setItemsProcessed(ctx.itemsProcessed());
                e.setItemsFailed(ctx.itemsFailed());
                if (!ctx.metadata().isEmpty()) {
                    e.setMetadataJson(Map.copyOf(ctx.metadata()));
                }
                repository.save(e);
            });
        } catch (Exception ex) {
            log.error("job_run: falha ao finalizar sucesso runId={}: {}", runId, ex.getMessage());
        }
    }

    private void finalizarErro(Long runId, Instant started, JobRunContext ctx, Exception ex) {
        if (runId == null || runId < 1) {
            return;
        }
        try {
            repository.findById(runId).ifPresent(e -> {
                Instant finished = Instant.now();
                e.setStatus(JobRunStatus.ERROR);
                e.setFinishedAt(finished);
                e.setDurationMs(Duration.between(started, finished).toMillis());
                e.setHeartbeatAt(finished);
                e.setItemsProcessed(ctx.itemsProcessed());
                e.setItemsFailed(ctx.itemsFailed());
                e.setErrorMessage(truncar(ex.getMessage(), 2000));
                e.setErrorStack(stackTrace(ex));
                if (!ctx.metadata().isEmpty()) {
                    e.setMetadataJson(Map.copyOf(ctx.metadata()));
                }
                repository.save(e);
            });
        } catch (Exception persistEx) {
            log.error(
                    "job_run: falha ao finalizar erro runId={} (erro original: {}): {}",
                    runId,
                    ex.getMessage(),
                    persistEx.getMessage());
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void marcarTimeout(JobRunEntity run) {
        try {
            Instant finished = Instant.now();
            run.setStatus(JobRunStatus.TIMEOUT);
            run.setFinishedAt(finished);
            if (run.getStartedAt() != null) {
                run.setDurationMs(Duration.between(run.getStartedAt(), finished).toMillis());
            }
            if (!StringUtils.hasText(run.getErrorMessage())) {
                run.setErrorMessage("Execução interrompida: sem heartbeat dentro do prazo configurado.");
            }
            repository.save(run);
        } catch (Exception ex) {
            log.warn("job_run: falha ao marcar timeout id={}: {}", run.getId(), ex.getMessage());
        }
    }

    private static String truncar(String s, int max) {
        if (s == null) {
            return null;
        }
        return s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }

    private static String stackTrace(Throwable t) {
        StringWriter sw = new StringWriter();
        t.printStackTrace(new PrintWriter(sw));
        String s = sw.toString();
        return s.length() > 65000 ? s.substring(0, 65000) : s;
    }
}
