package br.com.vilareal.whatsapp.api;

import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.CobrancaDTO;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.CobrancaItemDTO;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.CobrancaLoteResultDTO;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.CobrancaLoteResumoDTO;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.CobrancaPreviewDTO;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.CobrancaStatsDTO;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.CondominioResumoDTO;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.DispararCobrancaRequest;
import br.com.vilareal.whatsapp.service.CobrancaWhatsAppService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/whatsapp/cobrancas")
@Tag(name = "WhatsApp Cobranças", description = "Cobranças condominiais em lote via WhatsApp")
public class CobrancaWhatsAppController {

    private final CobrancaWhatsAppService cobrancaWhatsAppService;

    public CobrancaWhatsAppController(CobrancaWhatsAppService cobrancaWhatsAppService) {
        this.cobrancaWhatsAppService = cobrancaWhatsAppService;
    }

    @GetMapping("/condominios")
    @Operation(summary = "Listar condomínios distintos")
    public ResponseEntity<List<CondominioResumoDTO>> condominios() {
        return ResponseEntity.ok(cobrancaWhatsAppService.listarCondominios());
    }

    @GetMapping("/preview")
    @Operation(summary = "Preview de unidades com pendência para cobrança")
    public ResponseEntity<List<CobrancaPreviewDTO>> preview(
            @RequestParam(required = false) String condominio,
            @RequestParam(required = false) Long condominioId,
            @RequestParam(required = false) Long clienteId) {
        String condominioNome = resolverCondominioNome(condominio, condominioId);
        return ResponseEntity.ok(cobrancaWhatsAppService.buscarImoveisParaCobranca(condominioNome, clienteId));
    }

    @PostMapping("/disparar")
    @Operation(summary = "Disparar cobranças em lote")
    public ResponseEntity<CobrancaLoteResultDTO> disparar(@Valid @RequestBody DispararCobrancaRequest request) {
        String createdBy = currentUsername();
        CobrancaLoteResultDTO result = cobrancaWhatsAppService.dispararLote(
                request.itens(), request.loteDescricao(), createdBy);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/lotes")
    @Operation(summary = "Histórico de lotes de cobrança")
    public ResponseEntity<Page<CobrancaLoteResumoDTO>> lotes(
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(cobrancaWhatsAppService.listarLotes(PageRequest.of(page, size)));
    }

    @GetMapping("/lote/{loteId}")
    @Operation(summary = "Detalhes de um lote")
    public ResponseEntity<List<CobrancaDTO>> loteDetalhes(@PathVariable String loteId) {
        return ResponseEntity.ok(cobrancaWhatsAppService.detalhesLote(loteId));
    }

    @PostMapping("/reenviar/{loteId}")
    @Operation(summary = "Reenviar cobranças que falharam no lote")
    public ResponseEntity<Map<String, Integer>> reenviar(@PathVariable String loteId) {
        int reenviados = cobrancaWhatsAppService.reenviarFalhas(loteId);
        return ResponseEntity.ok(Map.of("reenviados", reenviados));
    }

    @GetMapping("/stats")
    @Operation(summary = "Estatísticas de cobranças do mês")
    public ResponseEntity<CobrancaStatsDTO> stats() {
        return ResponseEntity.ok(cobrancaWhatsAppService.statsDoMes());
    }

    private String resolverCondominioNome(String condominio, Long condominioId) {
        if (StringUtils.hasText(condominio)) {
            return condominio.trim();
        }
        if (condominioId == null) {
            return null;
        }
        return cobrancaWhatsAppService.listarCondominios().stream()
                .filter(c -> condominioId.equals(c.id()))
                .map(CondominioResumoDTO::nome)
                .findFirst()
                .orElse(null);
    }

    private static String currentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !StringUtils.hasText(auth.getName())) {
            return "sistema";
        }
        return auth.getName();
    }
}
