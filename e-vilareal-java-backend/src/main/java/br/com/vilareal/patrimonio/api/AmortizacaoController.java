package br.com.vilareal.patrimonio.api;

import br.com.vilareal.patrimonio.api.dto.*;
import br.com.vilareal.patrimonio.application.AmortizacaoApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/patrimonio/amortizacoes")
@Tag(name = "Patrimônio — Amortização vs investimento")
public class AmortizacaoController {

    private final AmortizacaoApplicationService service;

    public AmortizacaoController(AmortizacaoApplicationService service) {
        this.service = service;
    }

    @PostMapping("/simular")
    @Operation(description = """
            Compara amortizar vs. manter investido. Sempre retorna economia em valor presente
            e taxa implícita junto com meses eliminados (anti-gatilho emocional).
            """)
    public AmortizacaoComparacaoResponse simular(@Valid @RequestBody AmortizacaoSimulacaoRequest request) {
        return service.simular(request);
    }

    @GetMapping("/ranking")
    @Operation(description = "Ordem racional de quitação por CET decrescente, com recomendação por dívida.")
    public List<AmortizacaoComparacaoResponse> ranking() {
        return service.rankingPrioridade();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(description = "Solicita amortização extraordinária — fluxo de governança anti-impulso (§4.5).")
    public AmortizacaoResponse solicitar(@Valid @RequestBody AmortizacaoSolicitacaoRequest request) {
        return service.solicitar(request);
    }

    @PostMapping("/{id}/confirmar")
    @Operation(description = "Confirma decisão após período de reflexão. O sistema registra; não executa operação bancária.")
    public AmortizacaoResponse confirmar(@PathVariable Long id) {
        return service.confirmar(id);
    }

    @GetMapping
    public List<AmortizacaoResponse> listar(@RequestParam(required = false) Long passivoId) {
        return service.listar(passivoId);
    }
}
