package br.com.vilareal.calculo.api;

import br.com.vilareal.calculo.api.dto.AcordoDescumpridoProporRequest;
import br.com.vilareal.calculo.api.dto.AcordoDescumpridoProporResponse;
import br.com.vilareal.calculo.api.dto.AcordoRegistrarAndamentoRequest;
import br.com.vilareal.calculo.api.dto.CalculoClienteConfigResponse;
import br.com.vilareal.calculo.api.dto.CalculoParcelamentosConsolidadoResponse;
import br.com.vilareal.calculo.api.dto.CalculoParcelamentosConsolidadoResumo;
import br.com.vilareal.calculo.api.dto.CalculoRodadasResponse;
import br.com.vilareal.calculo.api.dto.CalculoRodadasResumoResponse;
import br.com.vilareal.calculo.api.dto.CalculoRodadasWriteRequest;
import br.com.vilareal.calculo.application.AcordoDescumpridoApplicationService;
import br.com.vilareal.calculo.application.AcordoOperacaoAndamentoService;
import br.com.vilareal.calculo.application.CalculoApplicationService;
import br.com.vilareal.calculo.application.CalculoParcelamentosConsolidadoApplicationService;
import com.fasterxml.jackson.databind.JsonNode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/calculos")
@Tag(name = "Cálculos", description = "Tela Calcular — rodadas e configuração por cliente (paridade Calculos.jsx)")
public class CalculoController {

    private final CalculoApplicationService calculoApplicationService;
    private final CalculoParcelamentosConsolidadoApplicationService parcelamentosConsolidadoService;
    private final AcordoDescumpridoApplicationService acordoDescumpridoService;
    private final AcordoOperacaoAndamentoService acordoOperacaoAndamentoService;

    public CalculoController(
            CalculoApplicationService calculoApplicationService,
            CalculoParcelamentosConsolidadoApplicationService parcelamentosConsolidadoService,
            AcordoDescumpridoApplicationService acordoDescumpridoService,
            AcordoOperacaoAndamentoService acordoOperacaoAndamentoService) {
        this.calculoApplicationService = calculoApplicationService;
        this.parcelamentosConsolidadoService = parcelamentosConsolidadoService;
        this.acordoDescumpridoService = acordoDescumpridoService;
        this.acordoOperacaoAndamentoService = acordoOperacaoAndamentoService;
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
            @PathVariable int dimensao,
            @RequestParam(required = false) Integer titulosPage,
            @RequestParam(required = false) Integer titulosLimit) {
        return calculoApplicationService
                .obterRodada(codigoCliente, processo, dimensao, titulosPage, titulosLimit)
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

    @GetMapping(value = "/parcelamentos/consolidado", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Parcelamentos aceitos consolidados", description = "Uma linha por parcela de acordo (parcelamentoAceito=true), paginado.")
    public ResponseEntity<CalculoParcelamentosConsolidadoResponse> listarParcelamentosConsolidado(
            @RequestParam(required = false) String clienteCodigo,
            @RequestParam(required = false) String processos,
            @RequestParam(required = false, defaultValue = "todas") String situacao,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate vencimentoDe,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate vencimentoAte,
            @RequestParam(required = false, defaultValue = "vencimento") String ordenarPor,
            @RequestParam(required = false, defaultValue = "true") boolean ordemAsc,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "50") int size) {
        List<Integer> procs = parseProcessos(processos);
        CalculoParcelamentosConsolidadoResponse body = parcelamentosConsolidadoService.listarConsolidado(
                clienteCodigo, procs, situacao, vencimentoDe, vencimentoAte, ordenarPor, ordemAsc, page, size);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .cacheControl(CacheControl.noStore())
                .body(body);
    }

    @GetMapping(value = "/parcelamentos/resumo-kpi", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "KPIs de parcelamentos (badge menu)", description = "Resumo rápido de vencidas e valores em aberto.")
    public CalculoParcelamentosConsolidadoResumo resumoKpiParcelamentos(
            @RequestParam(required = false) String clienteCodigo,
            @RequestParam(required = false) String processos) {
        return parcelamentosConsolidadoService.resumoKpi(clienteCodigo, parseProcessos(processos));
    }

    @PostMapping(value = "/acordo-descumprido/propor", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Propor descumprimento de acordo", description = "Monta títulos na próxima dimensão (proposta, sem aceitar pagamento).")
    public AcordoDescumpridoProporResponse proporAcordoDescumprido(@RequestBody AcordoDescumpridoProporRequest body) {
        return acordoDescumpridoService.propor(body);
    }

    @PostMapping("/acordos/registrar-andamento")
    @Operation(summary = "Registrar andamento de operação sobre acordo")
    public ResponseEntity<Void> registrarAndamentoAcordo(@RequestBody AcordoRegistrarAndamentoRequest body) {
        acordoOperacaoAndamentoService.registrar(
                body.processoId(),
                body.origem(),
                body.titulo(),
                body.detalhe(),
                AcordoOperacaoAndamentoService.novoImportacaoId());
        return ResponseEntity.noContent().build();
    }

    private static List<Integer> parseProcessos(String processos) {
        if (processos == null || processos.isBlank()) {
            return List.of();
        }
        return Arrays.stream(processos.split("[,;\\s]+"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> s.replaceAll("\\D", ""))
                .filter(s -> !s.isEmpty())
                .map(Integer::parseInt)
                .collect(Collectors.toList());
    }
}
