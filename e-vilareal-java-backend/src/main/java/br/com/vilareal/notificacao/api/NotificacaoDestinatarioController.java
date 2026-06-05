package br.com.vilareal.notificacao.api;

import br.com.vilareal.notificacao.api.dto.DestinatariosCanaisDto;
import br.com.vilareal.notificacao.api.dto.DestinatariosCanaisRequest;
import br.com.vilareal.notificacao.application.NotificacaoDestinatarioApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notificacao/destinatarios")
@Tag(name = "Notificação — destinatários", description = "Padrão global de destinatários por canal (sem envio)")
public class NotificacaoDestinatarioController {

    private final NotificacaoDestinatarioApplicationService notificacaoDestinatarioApplicationService;

    public NotificacaoDestinatarioController(
            NotificacaoDestinatarioApplicationService notificacaoDestinatarioApplicationService) {
        this.notificacaoDestinatarioApplicationService = notificacaoDestinatarioApplicationService;
    }

    @GetMapping("/padrao")
    @Operation(summary = "Listar destinatários padrão global (WhatsApp e e-mail)")
    public DestinatariosCanaisDto obterPadrao() {
        return notificacaoDestinatarioApplicationService.obterPadrao();
    }

    @PutMapping("/padrao")
    @Operation(summary = "Substituir destinatários padrão global")
    public DestinatariosCanaisDto substituirPadrao(@RequestBody DestinatariosCanaisRequest request) {
        return notificacaoDestinatarioApplicationService.substituirPadrao(request);
    }
}
