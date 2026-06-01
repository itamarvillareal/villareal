package br.com.vilareal.julia.api;

import br.com.vilareal.julia.api.dto.JuliaCaixaCardResponse;
import br.com.vilareal.julia.api.dto.JuliaCaixaPatchRequest;
import br.com.vilareal.julia.application.JuliaCaixaApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/julia/caixa")
@Tag(name = "Júlia — Caixa", description = "Caixa de entrada das triagens da Júlia")
public class JuliaCaixaController {

    private final JuliaCaixaApplicationService juliaCaixaApplicationService;

    public JuliaCaixaController(JuliaCaixaApplicationService juliaCaixaApplicationService) {
        this.juliaCaixaApplicationService = juliaCaixaApplicationService;
    }

    @GetMapping
    @Operation(
            summary = "Listar cards da caixa",
            description =
                    "Default AGUARDANDO_VOCE inclui também POSTERGADO com postergarAte <= hoje. Ordenação no cliente.")
    public List<JuliaCaixaCardResponse> listar(
            @RequestParam(value = "status", defaultValue = "AGUARDANDO_VOCE") String status) {
        return juliaCaixaApplicationService.listarCaixa(status);
    }

    @PatchMapping("/{triagemId}")
    @Operation(summary = "Atualizar estado de caixa da triagem")
    public JuliaCaixaCardResponse atualizar(
            @PathVariable Long triagemId, @RequestBody JuliaCaixaPatchRequest request) {
        return juliaCaixaApplicationService.atualizarCaixa(triagemId, request);
    }
}
