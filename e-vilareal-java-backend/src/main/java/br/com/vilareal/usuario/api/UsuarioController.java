package br.com.vilareal.usuario.api;

import br.com.vilareal.usuario.api.dto.UsuarioResponse;
import br.com.vilareal.usuario.api.dto.UsuarioWriteRequest;
import br.com.vilareal.usuario.application.UsuarioApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/usuarios")
@Tag(name = "Usuários")
public class UsuarioController {

    private final UsuarioApplicationService usuarioService;

    public UsuarioController(UsuarioApplicationService usuarioService) {
        this.usuarioService = usuarioService;
    }

    @GetMapping
    public List<UsuarioResponse> listar() {
        return usuarioService.listar();
    }

    @GetMapping("/{id}")
    public UsuarioResponse buscar(@PathVariable Long id) {
        return usuarioService.buscar(id);
    }

    @PostMapping
    public ResponseEntity<UsuarioResponse> criar(@Valid @RequestBody UsuarioWriteRequest request) {
        UsuarioResponse body = usuarioService.criar(request);
        URI uri = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(body.getId())
                .toUri();
        return ResponseEntity.created(uri).body(body);
    }

    @PutMapping("/{id}")
    public UsuarioResponse atualizar(@PathVariable Long id, @Valid @RequestBody UsuarioWriteRequest request) {
        return usuarioService.atualizar(id, request);
    }

    @PatchMapping("/{id}/ativo")
    @Operation(description = "Compatível com React: query ?value=true|false")
    public UsuarioResponse alterarAtivo(@PathVariable Long id, @RequestParam("value") boolean value) {
        return usuarioService.alterarAtivo(id, value);
    }

    @PutMapping("/{id}/perfis")
    @Operation(description = "Body JSON: array de IDs, ex. [1,2]")
    public UsuarioResponse definirPerfis(@PathVariable Long id, @RequestBody List<Long> perfilIds) {
        return usuarioService.definirPerfis(id, perfilIds);
    }
}
