package br.com.vilareal.whatsapp.api;

import br.com.vilareal.whatsapp.dto.AniversarioDTO;
import br.com.vilareal.whatsapp.dto.AniversarioStatsDTO;
import br.com.vilareal.whatsapp.dto.ProximoAniversarioDTO;
import br.com.vilareal.whatsapp.service.AniversarioWhatsAppService;
import br.com.vilareal.whatsapp.service.WhatsAppTemplateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

@RestController
@RequestMapping("/api/whatsapp/aniversarios")
@Tag(name = "WhatsApp Aniversários", description = "Felicitações de aniversário via WhatsApp")
public class WhatsAppAniversarioController {

    private static final ZoneId ZONE_BRASILIA = ZoneId.of("America/Sao_Paulo");

    private final AniversarioWhatsAppService aniversarioWhatsAppService;
    private final WhatsAppTemplateService whatsAppTemplateService;

    public WhatsAppAniversarioController(
            AniversarioWhatsAppService aniversarioWhatsAppService,
            WhatsAppTemplateService whatsAppTemplateService) {
        this.aniversarioWhatsAppService = aniversarioWhatsAppService;
        this.whatsAppTemplateService = whatsAppTemplateService;
    }

    @GetMapping
    @Operation(summary = "Listar felicitações enviadas")
    public ResponseEntity<Page<AniversarioDTO>> listar(
            @RequestParam(required = false) Integer ano,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int anoFiltro = ano != null ? ano : LocalDate.now(ZONE_BRASILIA).getYear();
        return ResponseEntity.ok(aniversarioWhatsAppService.listar(anoFiltro, PageRequest.of(page, size)));
    }

    @GetMapping("/proximos")
    @Operation(summary = "Próximos aniversários")
    public ResponseEntity<List<ProximoAniversarioDTO>> proximos(@RequestParam(defaultValue = "30") int dias) {
        return ResponseEntity.ok(aniversarioWhatsAppService.listarProximos(dias));
    }

    @GetMapping("/stats")
    @Operation(summary = "Estatísticas de aniversários")
    public ResponseEntity<AniversarioStatsDTO> stats() {
        return ResponseEntity.ok(aniversarioWhatsAppService.estatisticas());
    }

    @PostMapping("/enviar-manual/{pessoaId}")
    @Operation(summary = "Enviar felicitação manualmente")
    public ResponseEntity<AniversarioDTO> enviarManual(@PathVariable Long pessoaId) {
        return ResponseEntity.ok(aniversarioWhatsAppService.enviarManual(pessoaId));
    }

    @PostMapping("/garantir-template")
    @Operation(summary = "Garantir template de aniversário na Meta")
    public ResponseEntity<Void> garantirTemplate() {
        whatsAppTemplateService.garantirTemplateAniversario();
        return ResponseEntity.accepted().build();
    }
}
