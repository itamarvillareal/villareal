package br.com.vilareal.api.controller;

import br.com.vilareal.api.dto.PermissaoRequest;
import br.com.vilareal.api.dto.PermissaoResponse;
import br.com.vilareal.api.service.PermissaoService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/permissoes")
public class PermissaoController {
    private final PermissaoService permissaoService;

    public PermissaoController(PermissaoService permissaoService) {
        this.permissaoService = permissaoService;
    }

    @GetMapping
    public List<PermissaoResponse> listar() {
        return permissaoService.listar();
    }

    @PostMapping
    public ResponseEntity<PermissaoResponse> criar(@Valid @RequestBody PermissaoRequest request) {
        PermissaoResponse r = permissaoService.criar(request);
        return ResponseEntity.created(URI.create("/api/permissoes/" + r.getId())).body(r);
    }
}
