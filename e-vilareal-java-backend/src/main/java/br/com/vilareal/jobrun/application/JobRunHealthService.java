package br.com.vilareal.jobrun.application;

import br.com.vilareal.jobrun.api.dto.JobHealthItemResponse;
import br.com.vilareal.jobrun.api.dto.JobHealthResponse;
import br.com.vilareal.jobrun.api.dto.JobRunItemResponse;
import br.com.vilareal.jobrun.domain.JobNames;
import br.com.vilareal.jobrun.domain.JobRunStatus;
import br.com.vilareal.jobrun.infrastructure.persistence.entity.JobRunEntity;
import br.com.vilareal.jobrun.infrastructure.persistence.repository.JobRunRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class JobRunHealthService {

    public enum HealthFlag {
        OK,
        STALE,
        STUCK,
        FAILING,
        NEVER_RUN
    }

    private final JobRunRepository repository;
    private final JobRunProperties properties;
    private final JobRunTracker tracker;

    public JobRunHealthService(
            JobRunRepository repository, JobRunProperties properties, JobRunTracker tracker) {
        this.repository = repository;
        this.properties = properties;
        this.tracker = tracker;
    }

    public JobHealthResponse avaliarSaudeGeral() {
        limparRunsOrfaos();
        Instant agora = Instant.now();
        List<JobHealthItemResponse> itens = new ArrayList<>();
        for (String jobName : JobNames.TODOS_MONITORADOS) {
            itens.add(avaliarJob(jobName, agora));
        }
        return new JobHealthResponse(agora, itens);
    }

    public Page<JobRunItemResponse> listarRuns(String jobName, String statusRaw, int page, int size) {
        limparRunsOrfaos();
        int p = Math.max(0, page);
        int s = Math.min(200, Math.max(1, size));
        Pageable pageable = PageRequest.of(p, s);
        JobRunStatus status = parseStatus(statusRaw);
        String jobFilter = StringUtils.hasText(jobName) ? jobName.trim() : null;
        Page<JobRunEntity> pageResult = repository.findFiltrado(jobFilter, status, pageable);
        return pageResult.map(JobRunItemResponse::from);
    }

    public java.util.Optional<JobRunItemResponse> obterRun(Long id) {
        if (id == null || id < 1) {
            return java.util.Optional.empty();
        }
        limparRunsOrfaos();
        return repository.findById(id).map(JobRunItemResponse::from);
    }

    @Transactional
    @Scheduled(fixedRate = 300_000)
    public void limparRunsOrfaos() {
        Instant limite = Instant.now().minus(Duration.ofMinutes(properties.getOrphanRunningGraceMinutes()));
        List<JobRunEntity> orfaos = repository.findByStatusAndHeartbeatAtBefore(JobRunStatus.RUNNING, limite);
        for (JobRunEntity run : orfaos) {
            tracker.marcarTimeout(run);
        }
    }

    JobHealthItemResponse avaliarJob(String jobName, Instant agora) {
        JobRunProperties.JobDefinition def = properties.definitionFor(jobName);
        String displayName =
                StringUtils.hasText(def.getDisplayName()) ? def.getDisplayName() : jobName;

        JobRunEntity ultimo = repository.findFirstByJobNameOrderByStartedAtDescIdDesc(jobName).orElse(null);
        JobRunEntity running =
                repository.findFirstByJobNameAndStatusOrderByStartedAtDescIdDesc(jobName, JobRunStatus.RUNNING)
                        .orElse(null);

        HealthFlag flag = HealthFlag.NEVER_RUN;
        String detail = "Nunca executado com rastreamento.";
        Instant proximoEsperado = null;

        if (running != null) {
            Instant ref = running.getHeartbeatAt() != null ? running.getHeartbeatAt() : running.getStartedAt();
            long minutosRunning = Duration.between(ref, agora).toMinutes();
            if (minutosRunning > def.getMaxRunningMinutes()) {
                flag = HealthFlag.STUCK;
                detail = "Execução em andamento há " + minutosRunning + " min (limite "
                        + def.getMaxRunningMinutes() + " min).";
            } else {
                flag = HealthFlag.OK;
                detail = "Em execução agora.";
            }
        } else if (ultimo != null) {
            if (ultimo.getStatus() == JobRunStatus.ERROR || ultimo.getStatus() == JobRunStatus.TIMEOUT) {
                if (contagemErrosConsecutivos(jobName) >= properties.getFailingConsecutiveRuns()) {
                    flag = HealthFlag.FAILING;
                    detail = "Últimas execuções com falha.";
                } else {
                    flag = HealthFlag.STALE;
                    detail = "Última execução falhou; aguardando recuperação.";
                }
            } else if (ultimo.getStatus() == JobRunStatus.SUCCESS) {
                Instant ref = ultimo.getFinishedAt() != null ? ultimo.getFinishedAt() : ultimo.getStartedAt();
                long minutosDesde = Duration.between(ref, agora).toMinutes();
                if (minutosDesde > def.getExpectedIntervalMinutes()) {
                    flag = HealthFlag.STALE;
                    detail = "Sem sucesso há " + minutosDesde + " min (esperado a cada "
                            + def.getExpectedIntervalMinutes() + " min).";
                } else {
                    flag = HealthFlag.OK;
                    detail = "Última execução bem-sucedida há " + minutosDesde + " min.";
                }
                proximoEsperado = ref.plus(Duration.ofMinutes(def.getExpectedIntervalMinutes()));
            } else {
                flag = HealthFlag.OK;
                detail = "Estado: " + ultimo.getStatus();
            }
        }

        JobRunEntity refRun = running != null ? running : ultimo;
        return new JobHealthItemResponse(
                jobName,
                displayName,
                flag.name().toLowerCase(Locale.ROOT),
                detail,
                refRun != null ? refRun.getStatus().name() : null,
                refRun != null ? refRun.getStartedAt() : null,
                refRun != null ? refRun.getFinishedAt() : null,
                refRun != null ? refRun.getDurationMs() : null,
                refRun != null ? refRun.getItemsProcessed() : null,
                refRun != null ? refRun.getItemsFailed() : null,
                def.getExpectedIntervalMinutes(),
                def.getMaxRunningMinutes(),
                proximoEsperado,
                running != null);
    }

    private int contagemErrosConsecutivos(String jobName) {
        List<JobRunEntity> recentes = repository.findTop10ByJobNameOrderByStartedAtDescIdDesc(jobName);
        int count = 0;
        for (JobRunEntity r : recentes) {
            if (r.getStatus() == JobRunStatus.ERROR || r.getStatus() == JobRunStatus.TIMEOUT) {
                count++;
            } else if (r.getStatus() == JobRunStatus.SUCCESS) {
                break;
            }
        }
        return count;
    }

    private static JobRunStatus parseStatus(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        try {
            return JobRunStatus.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
