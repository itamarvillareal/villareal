package br.com.vilareal.auditoria.api;

import br.com.vilareal.auditoria.api.dto.AuditoriaAtividadeResponse;
import br.com.vilareal.auditoria.api.dto.AuditoriaAtividadeWriteRequest;
import br.com.vilareal.auditoria.application.AuditoriaAtividadeApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/auditoria/atividades")
@Tag(name = "Auditoria")
public class AuditoriaAtividadesController {

    private final AuditoriaAtividadeApplicationService service;

    public AuditoriaAtividadesController(AuditoriaAtividadeApplicationService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(description = "Relatório paginado de atividades (filtros alinhados ao React Atividade.jsx).")
    public Page<AuditoriaAtividadeResponse> listar(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFim,
            @RequestParam(required = false) String usuarioId,
            @RequestParam(required = false) String modulo,
            @RequestParam(required = false) String tipoAcao,
            @RequestParam(required = false) String registroAfetadoId,
            @RequestParam(required = false) String q,
            @PageableDefault(size = 20, sort = "ocorridoEm", direction = Sort.Direction.DESC) Pageable pageable) {
        return service.listar(dataInicio, dataFim, usuarioId, modulo, tipoAcao, registroAfetadoId, q, pageable);
    }

    @PostMapping
    @Operation(description = "Registra uma linha de auditoria (fire-and-forget no frontend).")
    public ResponseEntity<AuditoriaAtividadeResponse> registrar(
            @Valid @RequestBody AuditoriaAtividadeWriteRequest body,
            @RequestHeader(value = "X-VilaReal-Usuario-Id", required = false) String headerUsuarioId,
            @RequestHeader(value = "X-VilaReal-Usuario-Nome-B64", required = false) String headerUsuarioNomeB64,
            HttpServletRequest request) {
        String ip = resolveClientIp(request);
        AuditoriaAtividadeResponse saved = service.registrar(body, headerUsuarioId, headerUsuarioNomeB64, ip);
        return ResponseEntity.status(201).body(saved);
    }

    private static String resolveClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
