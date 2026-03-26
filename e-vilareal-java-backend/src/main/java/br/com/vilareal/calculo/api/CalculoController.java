package br.com.vilareal.calculo.api;

import br.com.vilareal.calculo.api.dto.CalculoClienteConfigResponse;
import br.com.vilareal.calculo.api.dto.CalculoRodadasResponse;
import br.com.vilareal.calculo.api.dto.CalculoRodadasWriteRequest;
import br.com.vilareal.calculo.application.CalculoApplicationService;
import com.fasterxml.jackson.databind.JsonNode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/calculos")
@Tag(name = "Cálculos", description = "Tela Calcular — rodadas e configuração por cliente (paridade Calculos.jsx)")
public class CalculoController {

    private final CalculoApplicationService calculoApplicationService;

    public CalculoController(CalculoApplicationService calculoApplicationService) {
        this.calculoApplicationService = calculoApplicationService;
    }

    @GetMapping("/rodadas")
    @Operation(summary = "Mapa de rodadas", description = "Mesmo formato do localStorage `vilareal.calculos.rodadas.v1`: chave `codigo8:proc:dimensao`.")
    public CalculoRodadasResponse listarRodadas() {
        return calculoApplicationService.listarRodadas();
    }

    @PutMapping("/rodadas")
    @Operation(summary = "Substituir todas as rodadas", description = "Upsert por chave e remove rodadas que não vierem no corpo (espelha save completo do front).")
    public ResponseEntity<Void> substituirRodadas(@Valid @RequestBody CalculoRodadasWriteRequest body) {
        calculoApplicationService.substituirRodadas(body);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/config-cliente/{codigoCliente}")
    @Operation(summary = "Config de cálculo do cliente", description = "Defaults + merge do que foi salvo (paridade `clienteConfigCalculoStorage.js`).")
    public CalculoClienteConfigResponse obterConfigCliente(@PathVariable String codigoCliente) {
        return calculoApplicationService.obterConfigCliente(codigoCliente);
    }

    @PutMapping("/config-cliente/{codigoCliente}")
    @Operation(summary = "Salvar config de cálculo do cliente")
    public CalculoClienteConfigResponse salvarConfigCliente(
            @PathVariable String codigoCliente, @RequestBody(required = false) JsonNode patch) {
        return calculoApplicationService.salvarConfigCliente(codigoCliente, patch);
    }
}
