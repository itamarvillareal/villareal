package br.com.vilareal.api.controller;

import br.com.vilareal.api.dto.ProcessoParteRequest;
import br.com.vilareal.api.dto.ProcessoParteResponse;
import br.com.vilareal.api.service.ProcessoParteService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/processos/{processoId}/partes")
public class ProcessoParteController {
    private final ProcessoParteService parteService;

    public ProcessoParteController(ProcessoParteService parteService) {
        this.parteService = parteService;
    }

    @GetMapping
    public List<ProcessoParteResponse> listar(@PathVariable Long processoId) {
        return parteService.listar(processoId);
    }

    @PostMapping
    public ResponseEntity<ProcessoParteResponse> criar(
            @PathVariable Long processoId,
            @Valid @RequestBody ProcessoParteRequest request) {
        ProcessoParteResponse r = parteService.criar(processoId, request);
        return ResponseEntity.created(URI.create("/api/processos/" + processoId + "/partes/" + r.getId())).body(r);
    }

    @PutMapping("/{parteId}")
    public ProcessoParteResponse atualizar(
            @PathVariable Long processoId,
            @PathVariable Long parteId,
            @Valid @RequestBody ProcessoParteRequest request) {
        return parteService.atualizar(processoId, parteId, request);
    }

    @DeleteMapping("/{parteId}")
    public ResponseEntity<Void> remover(@PathVariable Long processoId, @PathVariable Long parteId) {
        parteService.remover(processoId, parteId);
        return ResponseEntity.noContent().build();
    }
}
