package br.com.vilareal.api.controller;

import br.com.vilareal.api.dto.ProcessoRequest;
import br.com.vilareal.api.dto.ProcessoResponse;
import br.com.vilareal.api.service.ProcessoService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/processos")
public class ProcessoController {
    private final ProcessoService processoService;

    public ProcessoController(ProcessoService processoService) {
        this.processoService = processoService;
    }

    @GetMapping
    public List<ProcessoResponse> listar(
            @RequestParam(required = false) Long clienteId,
            @RequestParam(required = false) String codigoCliente,
            @RequestParam(required = false) Boolean ativo) {
        return processoService.listar(clienteId, codigoCliente, ativo);
    }

    @GetMapping("/{id}")
    public ProcessoResponse buscar(@PathVariable Long id) {
        return processoService.buscar(id);
    }

    @PostMapping
    public ResponseEntity<ProcessoResponse> criar(@Valid @RequestBody ProcessoRequest request) {
        ProcessoResponse r = processoService.criar(request);
        return ResponseEntity.created(URI.create("/api/processos/" + r.getId())).body(r);
    }

    @PutMapping("/{id}")
    public ProcessoResponse atualizar(@PathVariable Long id, @Valid @RequestBody ProcessoRequest request) {
        return processoService.atualizar(id, request);
    }

    @PatchMapping("/{id}/ativo")
    public ProcessoResponse alterarAtivo(@PathVariable Long id, @RequestParam boolean value) {
        return processoService.alterarAtivo(id, value);
    }
}
