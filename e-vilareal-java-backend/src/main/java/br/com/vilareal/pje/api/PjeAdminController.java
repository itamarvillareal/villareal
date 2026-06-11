package br.com.vilareal.pje.api;

import br.com.vilareal.pje.api.dto.PjeCopiaIntegralRequest;
import br.com.vilareal.pje.api.dto.PjeCopiaIntegralResponse;
import br.com.vilareal.pje.api.dto.PjeLoginResultResponse;
import br.com.vilareal.pje.api.dto.PjeTesteLoginRequest;
import br.com.vilareal.pje.application.PjeCopiaIntegralOrchestrator;
import br.com.vilareal.pje.application.PjeCopiaIntegralResult;
import br.com.vilareal.pje.application.PjeLoginOrchestrator;
import br.com.vilareal.pje.application.PjeLoginResult;
import br.com.vilareal.pje.config.PjeTrt18Properties;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/pje")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class PjeAdminController {

    private final PjeLoginOrchestrator loginOrchestrator;
    private final PjeCopiaIntegralOrchestrator copiaIntegralOrchestrator;
    private final PjeTrt18Properties properties;

    public PjeAdminController(
            PjeLoginOrchestrator loginOrchestrator,
            PjeCopiaIntegralOrchestrator copiaIntegralOrchestrator,
            PjeTrt18Properties properties) {
        this.loginOrchestrator = loginOrchestrator;
        this.copiaIntegralOrchestrator = copiaIntegralOrchestrator;
        this.properties = properties;
    }

    /**
     * Dispara login de teste no PJe TRT18. Senha opcional no corpo (teste manual); se omitida, usa o cofre TOTP.
     */
    @PostMapping("/trt18/teste-login")
    public PjeLoginResultResponse testeLogin(@Valid @RequestBody PjeTesteLoginRequest request) {
        PjeLoginResult resultado = loginOrchestrator
                .executarLogin(request.grau(), request.login(), request.senha())
                .orElseThrow(() -> new IllegalStateException("robô global ocupado"));
        return PjeLoginResultResponse.from(resultado, properties.isModoLeitura());
    }

    @PostMapping("/trt18/copia-integral")
    public PjeCopiaIntegralResponse copiaIntegral(@Valid @RequestBody PjeCopiaIntegralRequest request) {
        PjeCopiaIntegralResult resultado = copiaIntegralOrchestrator
                .executar(request.grau(), request.login(), request.senha(), request.numeroCnj())
                .orElseThrow(() -> new IllegalStateException("robô global ocupado"));
        return PjeCopiaIntegralResponse.from(resultado);
    }
}
