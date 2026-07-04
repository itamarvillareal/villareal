package br.com.vilareal.whatsapp.api;

import br.com.vilareal.whatsapp.dto.WhatsAppGrupoDTO;
import br.com.vilareal.whatsapp.dto.WhatsAppGrupoMaterializacaoResultDTO;
import br.com.vilareal.whatsapp.service.WhatsAppGrupoListService;
import br.com.vilareal.whatsapp.service.WhatsAppGrupoMaterializacaoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/whatsapp/grupos")
@Tag(name = "WhatsApp Grupos", description = "Materialização de clientes por conversa (abas por cliente)")
public class WhatsAppGrupoController {

    private final WhatsAppGrupoMaterializacaoService materializacaoService;
    private final WhatsAppGrupoListService grupoListService;

    public WhatsAppGrupoController(
            WhatsAppGrupoMaterializacaoService materializacaoService, WhatsAppGrupoListService grupoListService) {
        this.materializacaoService = materializacaoService;
        this.grupoListService = grupoListService;
    }

    @GetMapping
    @Operation(summary = "Listar clientes com conversa (abas por cliente)")
    public ResponseEntity<List<WhatsAppGrupoDTO>> listarGrupos() {
        return ResponseEntity.ok(grupoListService.listarGrupos());
    }

    @PostMapping("/materializar-agora")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    @Operation(
            summary = "Materializar clientes por conversa agora",
            description =
                    "Executa uma rodada completa do job de grupos (telefones distintos em whatsapp_messages). "
                            + "Requer ROLE_ADMIN.")
    public ResponseEntity<WhatsAppGrupoMaterializacaoResultDTO> materializarAgora() {
        return ResponseEntity.ok(materializacaoService.executarRodada());
    }
}
