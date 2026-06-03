package br.com.vilareal.jobrun.api;

import br.com.vilareal.jobrun.api.dto.JobHealthResponse;
import br.com.vilareal.jobrun.api.dto.JobRunItemResponse;
import br.com.vilareal.jobrun.api.dto.JobRunsPageResponse;
import br.com.vilareal.jobrun.application.JobRunHealthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/jobs")
@Tag(name = "Jobs", description = "Monitoramento de tarefas agendadas (cron / pipeline)")
public class JobRunController {

    private final JobRunHealthService healthService;

    public JobRunController(JobRunHealthService healthService) {
        this.healthService = healthService;
    }

    @GetMapping("/health")
    @Operation(summary = "Saúde resumida por job (stale / stuck / failing)")
    public JobHealthResponse health() {
        return healthService.avaliarSaudeGeral();
    }

    @GetMapping("/runs")
    @Operation(summary = "Histórico paginado de execuções")
    public JobRunsPageResponse runs(
            @RequestParam(required = false) String job_name,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int limit) {
        Page<JobRunItemResponse> p = healthService.listarRuns(job_name, status, page, limit);
        return new JobRunsPageResponse(
                p.getContent(),
                p.getNumber(),
                p.getSize(),
                p.getTotalElements(),
                p.getTotalPages(),
                p.isLast());
    }
}
