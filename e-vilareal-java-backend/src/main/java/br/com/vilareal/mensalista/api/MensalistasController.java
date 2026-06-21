package br.com.vilareal.mensalista.api;

import br.com.vilareal.mensalista.api.dto.MensalistaGerarMesResponse;
import br.com.vilareal.mensalista.api.dto.MensalistaResponse;
import br.com.vilareal.mensalista.api.dto.MensalistaWriteRequest;
import br.com.vilareal.mensalista.application.MensalistaApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/mensalistas")
@Tag(name = "Mensalistas", description = "Clientes com mensalidade recorrente (gera pagamentos RECEBER)")
public class MensalistasController {

    private final MensalistaApplicationService mensalistaService;

    public MensalistasController(MensalistaApplicationService mensalistaService) {
        this.mensalistaService = mensalistaService;
    }

    @GetMapping("/cliente/{clienteId}")
    @Operation(summary = "Buscar mensalista do cliente")
    public MensalistaResponse buscarPorCliente(@PathVariable Long clienteId) {
        return mensalistaService.buscarPorCliente(clienteId);
    }

    @PutMapping
    @Operation(summary = "Criar ou atualizar mensalista do cliente")
    public MensalistaResponse salvar(@Valid @RequestBody MensalistaWriteRequest body) {
        return mensalistaService.salvar(body);
    }

    @DeleteMapping("/cliente/{clienteId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Remover mensalista do cliente")
    public void remover(@PathVariable Long clienteId) {
        mensalistaService.removerPorCliente(clienteId);
    }

    @PostMapping("/gerar-mes")
    @Operation(
            summary = "Gerar recebíveis do mês",
            description = "Backfill ou teste manual. Idempotente por origem MENSALISTA:{id} + mes_referencia (AAAA-MM).")
    public MensalistaGerarMesResponse gerarMes(@RequestParam(required = false) String mesAno) {
        return mensalistaService.gerarMes(mesAno);
    }
}
