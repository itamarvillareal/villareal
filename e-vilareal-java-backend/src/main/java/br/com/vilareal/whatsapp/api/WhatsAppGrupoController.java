package br.com.vilareal.whatsapp.api;

import br.com.vilareal.whatsapp.dto.WhatsAppGrupoAtualizarRequest;
import br.com.vilareal.whatsapp.dto.WhatsAppGrupoDTO;
import br.com.vilareal.whatsapp.dto.WhatsAppGrupoSalvarRequest;
import br.com.vilareal.whatsapp.dto.WhatsAppGrupoSugestaoConversaDTO;
import br.com.vilareal.whatsapp.service.WhatsAppGrupoGestaoService;
import br.com.vilareal.whatsapp.service.WhatsAppGrupoListService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/whatsapp/grupos")
@Tag(name = "WhatsApp Grupos", description = "Grupos manuais de conversas por cliente (filtro na inbox)")
public class WhatsAppGrupoController {

    private final WhatsAppGrupoListService grupoListService;
    private final WhatsAppGrupoGestaoService grupoGestaoService;

    public WhatsAppGrupoController(
            WhatsAppGrupoListService grupoListService, WhatsAppGrupoGestaoService grupoGestaoService) {
        this.grupoListService = grupoListService;
        this.grupoGestaoService = grupoGestaoService;
    }

    @GetMapping
    @Operation(summary = "Listar grupos criados manualmente")
    public ResponseEntity<List<WhatsAppGrupoDTO>> listarGrupos() {
        return ResponseEntity.ok(grupoListService.listarGrupos());
    }

    @GetMapping("/{clienteCodigo}/sugestoes-conversas")
    @Operation(summary = "Sugerir conversas para compor um grupo (vínculo telefone × cliente)")
    public ResponseEntity<List<WhatsAppGrupoSugestaoConversaDTO>> sugerirConversas(
            @PathVariable String clienteCodigo) {
        return ResponseEntity.ok(grupoGestaoService.listarSugestoesConversas(clienteCodigo));
    }

    @PostMapping
    @Operation(summary = "Criar grupo com conversas selecionadas")
    public ResponseEntity<WhatsAppGrupoDTO> criarGrupo(@Valid @RequestBody WhatsAppGrupoSalvarRequest body) {
        return ResponseEntity.ok(grupoGestaoService.salvarGrupo(body.clienteCodigo(), body.phoneNumbers()));
    }

    @PutMapping("/{clienteCodigo}")
    @Operation(summary = "Atualizar conversas de um grupo existente")
    public ResponseEntity<WhatsAppGrupoDTO> atualizarGrupo(
            @PathVariable String clienteCodigo, @Valid @RequestBody WhatsAppGrupoAtualizarRequest body) {
        return ResponseEntity.ok(grupoGestaoService.salvarGrupo(clienteCodigo, body.phoneNumbers()));
    }

    @DeleteMapping("/{clienteCodigo}")
    @Operation(summary = "Excluir grupo (remove todas as conversas vinculadas)")
    public ResponseEntity<Void> excluirGrupo(@PathVariable String clienteCodigo) {
        grupoGestaoService.excluirGrupo(clienteCodigo);
        return ResponseEntity.noContent().build();
    }
}
