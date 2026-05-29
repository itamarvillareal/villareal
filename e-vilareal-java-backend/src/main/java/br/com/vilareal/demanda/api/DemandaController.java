package br.com.vilareal.demanda.api;

import br.com.vilareal.demanda.api.dto.*;
import br.com.vilareal.demanda.application.DemandaApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/demandas")
@Tag(name = "Demandas", description = "Cards de demandas para administração de imóveis")
public class DemandaController {

    private final DemandaApplicationService demandaApplicationService;

    public DemandaController(DemandaApplicationService demandaApplicationService) {
        this.demandaApplicationService = demandaApplicationService;
    }

    @GetMapping
    @Operation(summary = "Listar demandas com filtros opcionais")
    public List<DemandaResponse> listar(
            @RequestParam(required = false) Long imovelId,
            @RequestParam(required = false) Long clienteId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String categoria,
            @RequestParam(required = false) Boolean vencidas,
            @RequestParam(required = false) String busca) {
        return demandaApplicationService.listar(imovelId, clienteId, status, categoria, vencidas, busca);
    }

    @GetMapping("/metricas")
    @Operation(summary = "Métricas de demandas")
    public DemandaMetricasResponse metricas(
            @RequestParam(required = false) Long imovelId, @RequestParam(required = false) Long clienteId) {
        return demandaApplicationService.metricas(imovelId, clienteId);
    }

    @GetMapping("/acerto/{imovelId}")
    @Operation(summary = "Resumo de acerto por imóvel")
    public DemandaResumoAcertoResponse acerto(@PathVariable Long imovelId) {
        return demandaApplicationService.resumoAcertoImovel(imovelId);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Buscar demanda por ID")
    public DemandaResponse buscar(@PathVariable Long id) {
        return demandaApplicationService.buscar(id);
    }

    @GetMapping("/{id}/historico")
    @Operation(summary = "Histórico da demanda")
    public List<DemandaHistoricoResponse> historico(@PathVariable Long id) {
        return demandaApplicationService.listarHistorico(id);
    }

    @PostMapping
    @Operation(summary = "Criar demanda")
    public ResponseEntity<DemandaResponse> criar(@Valid @RequestBody DemandaWriteRequest request) {
        DemandaResponse body = demandaApplicationService.criar(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(body.id())
                .toUri();
        return ResponseEntity.created(location).body(body);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Atualizar demanda")
    public DemandaResponse atualizar(@PathVariable Long id, @Valid @RequestBody DemandaWriteRequest request) {
        return demandaApplicationService.atualizar(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Cancelar demanda (soft delete)")
    public DemandaResponse excluir(@PathVariable Long id) {
        return demandaApplicationService.excluir(id);
    }

    @PostMapping("/{id}/status")
    @Operation(summary = "Alterar status")
    public DemandaResponse alterarStatus(@PathVariable Long id, @Valid @RequestBody DemandaStatusRequest request) {
        return demandaApplicationService.alterarStatus(id, request.status(), null);
    }

    @PostMapping("/{id}/vincular-pagamento")
    @Operation(summary = "Vincular pagamento existente")
    public DemandaResponse vincularPagamento(
            @PathVariable Long id, @Valid @RequestBody DemandaVincularPagamentoRequest request) {
        return demandaApplicationService.vincularPagamento(id, request);
    }

    @PostMapping("/{id}/criar-pagamento")
    @Operation(summary = "Criar pagamento e vincular à demanda")
    public DemandaResponse criarPagamento(
            @PathVariable Long id, @RequestBody(required = false) DemandaCriarPagamentoRequest request) {
        return demandaApplicationService.criarPagamento(id, request != null ? request : new DemandaCriarPagamentoRequest(null, null, null, null, null));
    }

    @PostMapping("/{id}/desvincular-pagamento")
    @Operation(summary = "Desvincular pagamento")
    public DemandaResponse desvincularPagamento(@PathVariable Long id) {
        return demandaApplicationService.desvincularPagamento(id);
    }
}
