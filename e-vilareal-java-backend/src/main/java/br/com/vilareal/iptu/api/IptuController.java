package br.com.vilareal.iptu.api;

import br.com.vilareal.iptu.api.dto.*;
import br.com.vilareal.iptu.application.IptuApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/iptu")
@Tag(name = "IPTU", description = "Annual IPTU, instalments and city debt checks")
public class IptuController {

    private final IptuApplicationService iptuApplicationService;

    public IptuController(IptuApplicationService iptuApplicationService) {
        this.iptuApplicationService = iptuApplicationService;
    }

    @PostMapping("/anual")
    @Operation(summary = "Create or update annual IPTU and regenerate open instalments")
    public ResponseEntity<IptuAnualResponse> upsertAnual(@Valid @RequestBody IptuAnualWriteRequest req) {
        IptuAnualResponse body = iptuApplicationService.upsertValorAnual(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @GetMapping("/anual")
    public List<IptuAnualResponse> listarAnual(@RequestParam Long imovelId, @RequestParam(required = false) Integer ano) {
        return iptuApplicationService.listarAnuais(imovelId, ano);
    }

    @GetMapping("/anual/{id}")
    public IptuAnualResponse buscarAnual(@PathVariable Long id) {
        return iptuApplicationService.buscarAnual(id);
    }

    @PostMapping("/anual/{id}/recalcular")
    public List<IptuParcelaResponse> recalcular(@PathVariable Long id) {
        return iptuApplicationService.gerarParcelas(id);
    }

    @GetMapping("/parcelas")
    public org.springframework.data.domain.Page<IptuParcelaResponse> listarParcelas(
            @RequestParam Long imovelId,
            @RequestParam(required = false) Short ano,
            @RequestParam(required = false) Long contratoId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String competenciaInicio,
            @RequestParam(required = false) String competenciaFim,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "competenciaMes,asc") String sort) {
        Pageable p = PageRequest.of(Math.max(0, page), Math.min(Math.max(size, 1), 200), Sort.by(Sort.Order.by("competenciaMes").with(Sort.Direction.ASC)));
        if (sort != null && sort.contains("desc")) {
            p = PageRequest.of(Math.max(0, page), Math.min(Math.max(size, 1), 200), Sort.by(Sort.Order.by("competenciaMes").with(Sort.Direction.DESC)));
        }
        return iptuApplicationService.listarParcelas(
                imovelId, ano, contratoId, status, competenciaInicio, competenciaFim, p);
    }

    @PatchMapping("/parcelas/{id}/marcar-paga")
    public IptuParcelaResponse marcarPaga(
            @PathVariable Long id, @Valid @RequestBody IptuParcelaMarcarPagaRequest req) {
        return iptuApplicationService.marcarPaga(id, req);
    }

    @PatchMapping("/parcelas/{id}/cancelar")
    public IptuParcelaResponse cancelar(
            @PathVariable Long id, @Valid @RequestBody IptuParcelaCancelarRequest req) {
        return iptuApplicationService.cancelar(id, req);
    }

    @PostMapping("/consultas")
    public ResponseEntity<IptuConsultaDebitoResponse> registrarConsulta(
            @Valid @RequestBody IptuConsultaDebitoWriteRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(iptuApplicationService.registrarConsulta(req));
    }

    @GetMapping("/consultas")
    public List<IptuConsultaDebitoResponse> historicoConsultas(
            @RequestParam Long imovelId, @RequestParam(defaultValue = "50") int limit) {
        return iptuApplicationService.historicoConsultas(imovelId, limit);
    }

    @GetMapping("/dashboard")
    public List<IptuDashboardItemResponse> dashboard(
            @RequestParam Integer ano,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long imovelId) {
        return iptuApplicationService.dashboard(ano, status, imovelId);
    }
}
