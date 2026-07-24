package br.com.vilareal.configuracao.api;

import br.com.vilareal.configuracao.api.dto.UsuarioMenuPreferenciaRequest;
import br.com.vilareal.configuracao.api.dto.UsuarioMenuPreferenciaResponse;
import br.com.vilareal.configuracao.application.UsuarioMenuPreferenciaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/configuracoes/menu-lateral")
@Tag(name = "Configurações — menu lateral", description = "Visibilidade e ordem do menu por usuário")
public class UsuarioMenuPreferenciaController {

    private final UsuarioMenuPreferenciaService service;

    public UsuarioMenuPreferenciaController(UsuarioMenuPreferenciaService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "Obter preferência de menu do usuário autenticado")
    public UsuarioMenuPreferenciaResponse obterPropria() {
        return service.obterDoUsuarioAtual();
    }

    @PutMapping
    @Operation(summary = "Salvar preferência de menu do usuário autenticado")
    public UsuarioMenuPreferenciaResponse salvarPropria(@RequestBody UsuarioMenuPreferenciaRequest body) {
        return service.salvarDoUsuarioAtual(body);
    }

    @GetMapping("/{usuarioRef}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    @Operation(summary = "Obter preferência de menu de outro usuário (ADMIN)")
    public UsuarioMenuPreferenciaResponse obterDeUsuario(@PathVariable String usuarioRef) {
        return service.obterDeUsuario(usuarioRef);
    }

    @PutMapping("/{usuarioRef}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    @Operation(summary = "Salvar preferência de menu de outro usuário (ADMIN)")
    public UsuarioMenuPreferenciaResponse salvarDeUsuario(
            @PathVariable String usuarioRef, @RequestBody UsuarioMenuPreferenciaRequest body) {
        return service.salvarDeUsuario(usuarioRef, body);
    }
}
