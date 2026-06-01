package br.com.vilareal.julia.api;

import br.com.vilareal.julia.api.dto.JuliaBacklogAnaliseResponse;
import br.com.vilareal.julia.api.dto.JuliaBacklogJanelaResponse;
import br.com.vilareal.julia.application.JuliaTriagemService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/julia/admin")
@Tag(name = "Júlia — Admin (TEMP)", description = "Endpoints temporários de operação em lote")
public class JuliaAdminController {

    private final JuliaTriagemService juliaTriagemService;

    public JuliaAdminController(JuliaTriagemService juliaTriagemService) {
        this.juliaTriagemService = juliaTriagemService;
    }

    @PostMapping("/analisar-backlog-vencidos")
    @Operation(
            summary = "Analisar backlog de prazo fatal vencido (TEMP)",
            description =
                    "Processos ativos com prazo_fatal < hoje e publicação vinculada: triagem + andamento IA + card na caixa, sem novo prazo/agenda.")
    public JuliaBacklogAnaliseResponse analisarBacklogVencidos() {
        return juliaTriagemService.analisarBacklogPrazoFatalVencidos();
    }

    @PostMapping("/analisar-backlog")
    @Operation(
            summary = "Analisar backlog na janela de prazo fatal (TEMP)",
            description =
                    "Processos ativos com prazo_fatal entre (hoje − diasAntes) e (hoje + diasDepois): "
                            + "histórico + publicação recente (opcional); triagem + andamento IA + card na caixa, "
                            + "sem novo prazo/agenda; idempotência por processo.")
    public JuliaBacklogJanelaResponse analisarBacklogJanela(
            @RequestParam(defaultValue = "10") int diasAntes,
            @RequestParam(defaultValue = "10") int diasDepois) {
        return juliaTriagemService.analisarBacklogJanela(diasAntes, diasDepois);
    }
}
