package br.com.vilareal.api.controller;

import br.com.vilareal.api.dto.TarefaOperacionalRequest;
import br.com.vilareal.api.dto.TarefaOperacionalResponse;
import br.com.vilareal.api.dto.TarefaOperacionalStatusPatchRequest;
import br.com.vilareal.api.entity.enums.TarefaOperacionalPrioridade;
import br.com.vilareal.api.entity.enums.TarefaOperacionalStatus;
import br.com.vilareal.api.service.TarefaOperacionalService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/tarefas")
public class TarefaOperacionalController {
    private final TarefaOperacionalService tarefaOperacionalService;

    public TarefaOperacionalController(TarefaOperacionalService tarefaOperacionalService) {
        this.tarefaOperacionalService = tarefaOperacionalService;
    }

    @GetMapping
    public List<TarefaOperacionalResponse> listar(
            @RequestParam(required = false) Long responsavelId,
            @RequestParam(required = false) TarefaOperacionalStatus status,
            @RequestParam(required = false) TarefaOperacionalPrioridade prioridade,
            @RequestParam(required = false) Long clienteId,
            @RequestParam(required = false) Long processoId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataLimiteDe,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataLimiteAte
    ) {
        return tarefaOperacionalService.listar(
                responsavelId, status, prioridade, clienteId, processoId, dataLimiteDe, dataLimiteAte
        );
    }

    @GetMapping("/{id}")
    public TarefaOperacionalResponse buscar(@PathVariable Long id) {
        return tarefaOperacionalService.buscar(id);
    }

    @PostMapping
    public ResponseEntity<TarefaOperacionalResponse> criar(@Valid @RequestBody TarefaOperacionalRequest request) {
        TarefaOperacionalResponse r = tarefaOperacionalService.criar(request);
        return ResponseEntity.created(URI.create("/api/tarefas/" + r.getId())).body(r);
    }

    @PutMapping("/{id}")
    public TarefaOperacionalResponse atualizar(@PathVariable Long id, @Valid @RequestBody TarefaOperacionalRequest request) {
        return tarefaOperacionalService.atualizar(id, request);
    }

    @PatchMapping("/{id}/status")
    public TarefaOperacionalResponse alterarStatus(
            @PathVariable Long id,
            @Valid @RequestBody TarefaOperacionalStatusPatchRequest request) {
        return tarefaOperacionalService.alterarStatus(id, request);
    }
}
