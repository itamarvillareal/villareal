package br.com.vilareal.api.controller;

import br.com.vilareal.api.dto.ProcessoAndamentoRequest;
import br.com.vilareal.api.dto.ProcessoAndamentoResponse;
import br.com.vilareal.api.service.ProcessoAndamentoService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/processos/{processoId}/andamentos")
public class ProcessoAndamentoController {
    private final ProcessoAndamentoService andamentoService;

    public ProcessoAndamentoController(ProcessoAndamentoService andamentoService) {
        this.andamentoService = andamentoService;
    }

    @GetMapping
    public List<ProcessoAndamentoResponse> listar(@PathVariable Long processoId) {
        return andamentoService.listar(processoId);
    }

    @PostMapping
    public ResponseEntity<ProcessoAndamentoResponse> criar(
            @PathVariable Long processoId,
            @Valid @RequestBody ProcessoAndamentoRequest request) {
        ProcessoAndamentoResponse r = andamentoService.criar(processoId, request);
        return ResponseEntity.created(URI.create("/api/processos/" + processoId + "/andamentos/" + r.getId())).body(r);
    }

    @PutMapping("/{andamentoId}")
    public ProcessoAndamentoResponse atualizar(
            @PathVariable Long processoId,
            @PathVariable Long andamentoId,
            @Valid @RequestBody ProcessoAndamentoRequest request) {
        return andamentoService.atualizar(processoId, andamentoId, request);
    }

    @DeleteMapping("/{andamentoId}")
    public ResponseEntity<Void> remover(@PathVariable Long processoId, @PathVariable Long andamentoId) {
        andamentoService.remover(processoId, andamentoId);
        return ResponseEntity.noContent().build();
    }
}
