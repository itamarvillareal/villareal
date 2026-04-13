package br.com.vilareal.calculo.api;

import br.com.vilareal.calculo.api.dto.CalculoClienteConfigResponse;
import br.com.vilareal.calculo.api.dto.CalculoRodadasResponse;
import br.com.vilareal.calculo.api.dto.CalculoRodadasResumoResponse;
import br.com.vilareal.calculo.api.dto.CalculoRodadasWriteRequest;
import br.com.vilareal.calculo.application.CalculoApplicationService;
import com.fasterxml.jackson.databind.JsonNode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
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

    /**
     * Sempre <strong>200</strong> com corpo JSON {@code {"rodadas":{...}}} (mapa pode estar vazio).
     * <p>Não confundir com {@link #substituirRodadas(CalculoRodadasWriteRequest)} (PUT), que responde <strong>204</strong> sem corpo.</p>
     */
    @GetMapping(value = "/rodadas", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Mapa de rodadas", description = "Mesmo formato do localStorage `vilareal.calculos.rodadas.v1`: chave `codigo8:proc:dimensao`.")
    public ResponseEntity<CalculoRodadasResponse> listarRodadas() {
        CalculoRodadasResponse body = calculoApplicationService.listarRodadas();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .cacheControl(CacheControl.noStore())
                .body(body);
    }

    @GetMapping(value = "/rodadas/resumo", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Resumo de rodadas",
            description = "Lista chaves `codigo8:proc:dim` e `parcelamentoAceito` apenas (sem payload completo).")
    public ResponseEntity<CalculoRodadasResumoResponse> listarResumoRodadas() {
        CalculoRodadasResumoResponse body = calculoApplicationService.listarResumoRodadas();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .cacheControl(CacheControl.noStore())
                .body(body);
    }

    @GetMapping(value = "/rodadas/{codigoCliente}/{processo}/{dimensao}", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Obter uma rodada", description = "Payload JSON da rodada; 404 se não existir.")
    public ResponseEntity<JsonNode> obterRodada(
            @PathVariable String codigoCliente,
            @PathVariable int processo,
            @PathVariable int dimensao) {
        return calculoApplicationService
                .obterRodada(codigoCliente, processo, dimensao)
                .map(node -> ResponseEntity.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .cacheControl(CacheControl.noStore())
                        .body(node))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping(value = "/rodadas/{codigoCliente}/{processo}/{dimensao}", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Salvar uma rodada", description = "Upsert por chave; não remove outras rodadas.")
    public ResponseEntity<JsonNode> salvarRodada(
            @PathVariable String codigoCliente,
            @PathVariable int processo,
            @PathVariable int dimensao,
            @RequestBody JsonNode payload) {
        JsonNode saved = calculoApplicationService.salvarRodada(codigoCliente, processo, dimensao, payload);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .cacheControl(CacheControl.noStore())
                .body(saved);
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
