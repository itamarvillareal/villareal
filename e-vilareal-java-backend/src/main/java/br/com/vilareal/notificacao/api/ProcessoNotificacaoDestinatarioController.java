package br.com.vilareal.notificacao.api;

import br.com.vilareal.notificacao.api.dto.DestinatariosCanaisRequest;
import br.com.vilareal.notificacao.api.dto.ProcessoDestinatariosResponse;
import br.com.vilareal.notificacao.application.NotificacaoDestinatarioApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/processos/{processoId}/notificacao/destinatarios")
@Tag(name = "Processo — notificação", description = "Override de destinatários por processo (sem envio)")
public class ProcessoNotificacaoDestinatarioController {

    private final NotificacaoDestinatarioApplicationService notificacaoDestinatarioApplicationService;

    public ProcessoNotificacaoDestinatarioController(
            NotificacaoDestinatarioApplicationService notificacaoDestinatarioApplicationService) {
        this.notificacaoDestinatarioApplicationService = notificacaoDestinatarioApplicationService;
    }

    @GetMapping
    @Operation(summary = "Override, personalizado e destinatários efetivos do processo")
    public ProcessoDestinatariosResponse obter(@PathVariable Long processoId) {
        return notificacaoDestinatarioApplicationService.obterProcesso(processoId);
    }

    @PutMapping
    @Operation(summary = "Substituir override de destinatários do processo")
    public ProcessoDestinatariosResponse substituir(
            @PathVariable Long processoId, @RequestBody DestinatariosCanaisRequest request) {
        return notificacaoDestinatarioApplicationService.substituirOverrideProcesso(processoId, request);
    }

    @DeleteMapping
    @Operation(summary = "Remover override (volta ao padrão global por canal)")
    public ProcessoDestinatariosResponse remover(@PathVariable Long processoId) {
        return notificacaoDestinatarioApplicationService.removerOverrideProcesso(processoId);
    }
}
