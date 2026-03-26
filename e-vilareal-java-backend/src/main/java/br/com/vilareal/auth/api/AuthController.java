package br.com.vilareal.auth.api;

import br.com.vilareal.auth.api.dto.LoginRequest;
import br.com.vilareal.auth.api.dto.LoginResponse;
import br.com.vilareal.auth.api.dto.UsuarioLogadoDto;
import br.com.vilareal.auth.application.AuthApplicationService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Autenticação")
public class AuthController {

    private final AuthApplicationService authService;

    public AuthController(AuthApplicationService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @GetMapping("/me")
    public UsuarioLogadoDto me(@AuthenticationPrincipal UserDetails user) {
        return authService.me(user.getUsername());
    }
}
