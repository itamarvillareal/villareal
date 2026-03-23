package br.com.vilareal.api.controller;

import br.com.vilareal.api.dto.ProcessoPrazoRequest;
import br.com.vilareal.api.dto.ProcessoPrazoResponse;
import br.com.vilareal.api.service.ProcessoPrazoService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/processos/{processoId}/prazos")
public class ProcessoPrazoController {
    private final ProcessoPrazoService prazoService;

    public ProcessoPrazoController(ProcessoPrazoService prazoService) {
        this.prazoService = prazoService;
    }

    @GetMapping
    public List<ProcessoPrazoResponse> listar(@PathVariable Long processoId) {
        return prazoService.listar(processoId);
    }

    @PostMapping
    public ResponseEntity<ProcessoPrazoResponse> criar(
            @PathVariable Long processoId,
            @Valid @RequestBody ProcessoPrazoRequest request) {
        ProcessoPrazoResponse r = prazoService.criar(processoId, request);
        return ResponseEntity.created(URI.create("/api/processos/" + processoId + "/prazos/" + r.getId())).body(r);
    }

    @PutMapping("/{prazoId}")
    public ProcessoPrazoResponse atualizar(
            @PathVariable Long processoId,
            @PathVariable Long prazoId,
            @Valid @RequestBody ProcessoPrazoRequest request) {
        return prazoService.atualizar(processoId, prazoId, request);
    }

    @PatchMapping("/{prazoId}/cumprimento")
    public ProcessoPrazoResponse alterarCumprimento(
            @PathVariable Long processoId,
            @PathVariable Long prazoId,
            @RequestParam boolean cumprido) {
        return prazoService.alterarCumprimento(processoId, prazoId, cumprido);
    }

    @DeleteMapping("/{prazoId}")
    public ResponseEntity<Void> remover(@PathVariable Long processoId, @PathVariable Long prazoId) {
        prazoService.remover(processoId, prazoId);
        return ResponseEntity.noContent().build();
    }
}
