package br.com.vilareal.tarefa.api;

import br.com.vilareal.tarefa.api.dto.TarefaOperacionalResponse;
import br.com.vilareal.tarefa.api.dto.TarefaOperacionalWriteRequest;
import br.com.vilareal.tarefa.api.dto.TarefaStatusPatchRequest;
import br.com.vilareal.tarefa.application.TarefaOperacionalApplicationService;
import br.com.vilareal.tarefa.model.TarefaPrioridade;
import br.com.vilareal.tarefa.model.TarefaStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/tarefas")
@Tag(name = "Tarefas operacionais")
public class TarefaOperacionalController {

    private final TarefaOperacionalApplicationService tarefaService;

    public TarefaOperacionalController(TarefaOperacionalApplicationService tarefaService) {
        this.tarefaService = tarefaService;
    }

    @GetMapping
    @Operation(description = "Lista tarefas (Pendências / board). Query params alinhados ao React `tarefasOperacionaisRepository.js`.")
    public List<TarefaOperacionalResponse> listar(
            @RequestParam(value = "responsavelId", required = false) Long responsavelId,
            @RequestParam(value = "status", required = false) TarefaStatus status,
            @RequestParam(value = "prioridade", required = false) TarefaPrioridade prioridade,
            @RequestParam(value = "clienteId", required = false) Long clienteId,
            @RequestParam(value = "processoId", required = false) Long processoId,
            @RequestParam(value = "dataLimiteDe", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataLimiteDe,
            @RequestParam(value = "dataLimiteAte", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataLimiteAte) {
        return tarefaService.listar(responsavelId, status, prioridade, clienteId, processoId, dataLimiteDe, dataLimiteAte);
    }

    @GetMapping("/paginada")
    @Operation(description = "Mesmos filtros de GET /api/tarefas, com paginação Spring Data.")
    public Page<TarefaOperacionalResponse> listarPaginada(
            @RequestParam(value = "responsavelId", required = false) Long responsavelId,
            @RequestParam(value = "status", required = false) TarefaStatus status,
            @RequestParam(value = "prioridade", required = false) TarefaPrioridade prioridade,
            @RequestParam(value = "clienteId", required = false) Long clienteId,
            @RequestParam(value = "processoId", required = false) Long processoId,
            @RequestParam(value = "dataLimiteDe", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataLimiteDe,
            @RequestParam(value = "dataLimiteAte", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataLimiteAte,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return tarefaService.listarPaginado(
                responsavelId, status, prioridade, clienteId, processoId, dataLimiteDe, dataLimiteAte, pageable);
    }

    @GetMapping("/{id}")
    public TarefaOperacionalResponse buscar(@PathVariable Long id) {
        return tarefaService.buscar(id);
    }

    @PostMapping
    public ResponseEntity<TarefaOperacionalResponse> criar(@Valid @RequestBody TarefaOperacionalWriteRequest request) {
        TarefaOperacionalResponse body = tarefaService.criar(request);
        URI uri = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(body.getId())
                .toUri();
        return ResponseEntity.created(uri).body(body);
    }

    @PutMapping("/{id}")
    public TarefaOperacionalResponse atualizar(@PathVariable Long id, @Valid @RequestBody TarefaOperacionalWriteRequest request) {
        return tarefaService.atualizar(id, request);
    }

    @PatchMapping("/{id}/status")
    public TarefaOperacionalResponse patchStatus(@PathVariable Long id, @Valid @RequestBody TarefaStatusPatchRequest request) {
        return tarefaService.patchStatus(id, request);
    }
}
