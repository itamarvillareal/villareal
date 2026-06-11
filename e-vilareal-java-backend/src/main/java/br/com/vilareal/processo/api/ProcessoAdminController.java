package br.com.vilareal.processo.api;

import br.com.vilareal.processo.api.dto.ProcessoTramitacaoBackfillResponse;
import br.com.vilareal.processo.application.ProcessoTramitacaoBackfillService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/processos")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
@Tag(name = "Processos (admin)", description = "Operações administrativas em processos")
public class ProcessoAdminController {

    private final ProcessoTramitacaoBackfillService tramitacaoBackfillService;

    public ProcessoAdminController(ProcessoTramitacaoBackfillService tramitacaoBackfillService) {
        this.tramitacaoBackfillService = tramitacaoBackfillService;
    }

    @PostMapping("/tramitacao/backfill")
    @Operation(
            summary = "Backfill de tramitação",
            description =
                    "Preenche processo.tramitacao vazio a partir de publicações vinculadas (PROJUDI > TRT .5.18. > "
                            + "MONITORAMENTO por CNJ). Use dryRun=true para simular.")
    public ProcessoTramitacaoBackfillResponse backfillTramitacao(
            @RequestParam(value = "dryRun", defaultValue = "false") boolean dryRun) {
        return tramitacaoBackfillService.executar(dryRun);
    }
}
