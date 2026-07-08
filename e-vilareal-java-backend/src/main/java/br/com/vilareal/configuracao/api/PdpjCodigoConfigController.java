package br.com.vilareal.configuracao.api;

import br.com.vilareal.configuracao.api.dto.PdpjCodigoResponse;
import br.com.vilareal.configuracao.application.PdpjCodigoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/configuracoes/pdpj-codigo")
@Tag(name = "Configurações — PDPJ", description = "Código TOTP do autenticador para login PDPJ/PJe")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class PdpjCodigoConfigController {

    private final PdpjCodigoService pdpjCodigoService;

    public PdpjCodigoConfigController(PdpjCodigoService pdpjCodigoService) {
        this.pdpjCodigoService = pdpjCodigoService;
    }

    @GetMapping
    @Operation(summary = "Código TOTP atual do PDPJ (PJe TRT18)")
    public PdpjCodigoResponse obterCodigoAtual() {
        return pdpjCodigoService.obterCodigoAtual();
    }
}
