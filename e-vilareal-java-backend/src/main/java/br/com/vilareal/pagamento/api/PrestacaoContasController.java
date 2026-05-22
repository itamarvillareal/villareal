package br.com.vilareal.pagamento.api;

import br.com.vilareal.pagamento.api.dto.prestacao.*;
import br.com.vilareal.pagamento.application.PrestacaoContasApplicationService;
import br.com.vilareal.pagamento.domain.PrestacaoContasStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/prestacao-contas")
@Tag(name = "Prestação de contas", description = "Acerto formal com proprietário do imóvel")
public class PrestacaoContasController {

    private final PrestacaoContasApplicationService prestacaoContasService;

    public PrestacaoContasController(PrestacaoContasApplicationService prestacaoContasService) {
        this.prestacaoContasService = prestacaoContasService;
    }

    @GetMapping("/pagamentos-pendentes")
    @Operation(summary = "Pagamentos CONFERIDO sem prestação, agrupados por imóvel")
    public List<PrestacaoContasPendenteGrupoResponse> pagamentosPendentes(
            @RequestParam Long clienteId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodoInicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodoFim) {
        return prestacaoContasService.pagamentosPendentes(clienteId, periodoInicio, periodoFim);
    }

    @PostMapping
    public PrestacaoContasDetailResponse criar(@Valid @RequestBody PrestacaoContasCreateRequest req) {
        return prestacaoContasService.criar(req);
    }

    @GetMapping
    public Page<PrestacaoContasListItemResponse> listar(
            @RequestParam(required = false) Long clienteId,
            @RequestParam(required = false) PrestacaoContasStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodoInicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodoFim,
            @PageableDefault(size = 20, sort = "criadoEm", direction = Sort.Direction.DESC) Pageable pageable) {
        return prestacaoContasService.listar(clienteId, status, periodoInicio, periodoFim, pageable);
    }

    @GetMapping("/{id}")
    public PrestacaoContasDetailResponse buscar(@PathVariable Long id) {
        return prestacaoContasService.buscarDetalhe(id);
    }

    @PutMapping("/{id}")
    public PrestacaoContasDetailResponse atualizar(
            @PathVariable Long id, @Valid @RequestBody PrestacaoContasUpdateRequest req) {
        return prestacaoContasService.atualizar(id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable Long id) {
        prestacaoContasService.excluir(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/enviar")
    public PrestacaoContasDetailResponse enviar(@PathVariable Long id) throws Exception {
        return prestacaoContasService.enviar(id);
    }

    @PostMapping("/{id}/aprovar")
    public PrestacaoContasDetailResponse aprovar(@PathVariable Long id) {
        return prestacaoContasService.aprovar(id);
    }

    @GetMapping("/{id}/pdf")
    public ResponseEntity<Resource> downloadPdf(@PathVariable Long id) throws Exception {
        Resource resource = prestacaoContasService.recursoPdf(id);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"prestacao_contas_" + id + ".pdf\"")
                .body(resource);
    }
}
