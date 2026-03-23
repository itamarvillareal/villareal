package br.com.vilareal.api.controller;

import br.com.vilareal.api.dto.ContaContabilRequest;
import br.com.vilareal.api.dto.ContaContabilResponse;
import br.com.vilareal.api.service.ContaContabilService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/financeiro/contas")
public class FinanceiroContaController {
    private final ContaContabilService contaContabilService;

    public FinanceiroContaController(ContaContabilService contaContabilService) {
        this.contaContabilService = contaContabilService;
    }

    @GetMapping
    public List<ContaContabilResponse> listar() {
        return contaContabilService.listar();
    }

    @PostMapping
    public ResponseEntity<ContaContabilResponse> criar(@Valid @RequestBody ContaContabilRequest request) {
        ContaContabilResponse r = contaContabilService.criar(request);
        return ResponseEntity.created(URI.create("/api/financeiro/contas/" + r.getId())).body(r);
    }

    @PutMapping("/{id}")
    public ContaContabilResponse atualizar(@PathVariable Long id, @Valid @RequestBody ContaContabilRequest request) {
        return contaContabilService.atualizar(id, request);
    }
}
