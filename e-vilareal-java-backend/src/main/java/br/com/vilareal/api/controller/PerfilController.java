package br.com.vilareal.api.controller;

import br.com.vilareal.api.dto.PerfilPermissoesRequest;
import br.com.vilareal.api.dto.PerfilRequest;
import br.com.vilareal.api.dto.PerfilResponse;
import br.com.vilareal.api.service.PerfilService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/perfis")
public class PerfilController {
    private final PerfilService perfilService;

    public PerfilController(PerfilService perfilService) {
        this.perfilService = perfilService;
    }

    @GetMapping
    public List<PerfilResponse> listar() {
        return perfilService.listar();
    }

    @PostMapping
    public ResponseEntity<PerfilResponse> criar(@Valid @RequestBody PerfilRequest request) {
        PerfilResponse r = perfilService.criar(request);
        return ResponseEntity.created(URI.create("/api/perfis/" + r.getId())).body(r);
    }

    @PutMapping("/{id}")
    public PerfilResponse atualizar(@PathVariable Long id, @Valid @RequestBody PerfilRequest request) {
        return perfilService.atualizar(id, request);
    }

    @PutMapping("/{id}/permissoes")
    public PerfilResponse definirPermissoes(@PathVariable Long id, @RequestBody PerfilPermissoesRequest request) {
        return perfilService.definirPermissoes(id, request.getPermissaoIds());
    }
}
