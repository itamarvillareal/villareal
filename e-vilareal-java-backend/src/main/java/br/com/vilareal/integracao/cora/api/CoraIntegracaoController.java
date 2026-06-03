package br.com.vilareal.integracao.cora.api;

import br.com.vilareal.integracao.cora.CoraHealthResult;
import br.com.vilareal.integracao.cora.CoraHealthService;
import br.com.vilareal.integracao.cora.CoraProperties;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoints administrativos da integração Cora (produção).
 * Sempre registrado; com {@code cora.enabled=false} não tenta conectar.
 */
@RestController
@RequestMapping("/api/integracao/cora")
@Tag(name = "Integração Cora", description = "Fundação mTLS + token (Integração Direta)")
public class CoraIntegracaoController {

    private final CoraProperties coraProperties;
    private final ObjectProvider<CoraHealthService> healthService;

    public CoraIntegracaoController(CoraProperties coraProperties, ObjectProvider<CoraHealthService> healthService) {
        this.coraProperties = coraProperties;
        this.healthService = healthService;
    }

    @GetMapping("/health")
    @Operation(summary = "Health read-only da integração Cora (mTLS, token, extrato curto)")
    public CoraHealthResult health() {
        if (!coraProperties.isEnabled()) {
            return CoraHealthResult.disabled();
        }
        return healthService.getObject().check();
    }
}
