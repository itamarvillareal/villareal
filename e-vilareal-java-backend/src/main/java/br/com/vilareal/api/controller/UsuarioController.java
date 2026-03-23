package br.com.vilareal.api.controller;

import br.com.vilareal.api.dto.*;
import br.com.vilareal.api.service.UsuarioService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/usuarios")
public class UsuarioController {
    private final UsuarioService usuarioService;

    public UsuarioController(UsuarioService usuarioService) {
        this.usuarioService = usuarioService;
    }

    @GetMapping
    public List<UsuarioResponse> listar() {
        return usuarioService.listar();
    }

    @PostMapping
    public ResponseEntity<UsuarioResponse> criar(@Valid @RequestBody UsuarioRequest request) {
        UsuarioResponse r = usuarioService.criar(request);
        return ResponseEntity.created(URI.create("/api/usuarios/" + r.getId())).body(r);
    }

    @PutMapping("/{id}")
    public UsuarioResponse atualizar(@PathVariable Long id, @Valid @RequestBody UsuarioRequest request) {
        return usuarioService.atualizar(id, request);
    }

    @PatchMapping("/{id}/ativo")
    public UsuarioResponse alterarAtivo(@PathVariable Long id, @Valid @RequestBody UsuarioAtivoRequest request) {
        return usuarioService.alterarAtivo(id, Boolean.TRUE.equals(request.getAtivo()));
    }

    @PutMapping("/{id}/perfis")
    public UsuarioResponse definirPerfis(@PathVariable Long id, @RequestBody UsuarioPerfisRequest request) {
        return usuarioService.definirPerfis(id, request.getPerfilIds());
    }
}
