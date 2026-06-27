package br.com.vilareal.configuracao.api;

import br.com.vilareal.configuracao.api.dto.ProjudiProtocoloEmailConfigRequest;
import br.com.vilareal.configuracao.api.dto.ProjudiProtocoloEmailConfigResponse;
import br.com.vilareal.projudi.application.ProjudiProtocoloEmailConfigService;
import br.com.vilareal.projudi.config.ProjudiProtocoloEmailProperties;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/configuracoes/projudi-protocolo-email")
@Tag(name = "Configurações — protocolo PROJUDI", description = "E-mails de sucesso/erro do protocolo agendado")
public class ProjudiProtocoloEmailConfigController {

    private final ProjudiProtocoloEmailConfigService configService;
    private final ProjudiProtocoloEmailProperties properties;

    public ProjudiProtocoloEmailConfigController(
            ProjudiProtocoloEmailConfigService configService, ProjudiProtocoloEmailProperties properties) {
        this.configService = configService;
        this.properties = properties;
    }

    @GetMapping
    @Operation(summary = "Obter destinatários de e-mail do protocolo PROJUDI")
    public ProjudiProtocoloEmailConfigResponse obter() {
        return montarResposta(configService.getDestinatariosConfigurados());
    }

    @PutMapping
    @Operation(summary = "Salvar destinatários de e-mail do protocolo PROJUDI")
    public ProjudiProtocoloEmailConfigResponse salvar(@RequestBody ProjudiProtocoloEmailConfigRequest body) {
        return montarResposta(configService.salvarDestinatarios(body != null ? body.destinatarios() : null));
    }

    private ProjudiProtocoloEmailConfigResponse montarResposta(java.util.List<String> destinatarios) {
        return new ProjudiProtocoloEmailConfigResponse(
                properties.isAtivo(),
                properties.getAssuntoPrefixo(),
                destinatarios);
    }
}
