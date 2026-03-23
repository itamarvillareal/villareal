package br.com.vilareal.api.controller;

import br.com.vilareal.api.dto.AuditoriaAtividadePaginaResponse;
import br.com.vilareal.api.dto.AuditoriaAtividadeRequest;
import br.com.vilareal.api.dto.AuditoriaAtividadeResponse;
import br.com.vilareal.api.service.AuditoriaAtividadeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/auditoria/atividades")
@Tag(name = "Auditoria", description = "Log de atividades e relatório de auditoria")
public class AuditoriaAtividadeController {

    private final AuditoriaAtividadeService service;

    public AuditoriaAtividadeController(AuditoriaAtividadeService service) {
        this.service = service;
    }

    @PostMapping
    @Operation(summary = "Registrar atividade", description = "Grava um evento de auditoria (usuário via cabeçalhos ou corpo).")
    public ResponseEntity<AuditoriaAtividadeResponse> registrar(@Valid @RequestBody AuditoriaAtividadeRequest request) {
        AuditoriaAtividadeResponse body = service.registrar(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @GetMapping
    @Operation(summary = "Listar / filtrar", description = "Relatório paginado; ordenação padrão por data/hora decrescente.")
    public ResponseEntity<AuditoriaAtividadePaginaResponse> listar(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFim,
            @RequestParam(required = false) String usuarioId,
            @RequestParam(required = false) String modulo,
            @RequestParam(required = false) String tipoAcao,
            @RequestParam(required = false) String registroAfetadoId,
            @RequestParam(required = false) String q,
            @PageableDefault(size = 20, sort = "ocorridoEm", direction = Sort.Direction.DESC) Pageable pageable) {
        Page<AuditoriaAtividadeResponse> page = service.buscar(
                dataInicio, dataFim, usuarioId, modulo, tipoAcao, registroAfetadoId, q, pageable);
        return ResponseEntity.ok(AuditoriaAtividadePaginaResponse.of(page));
    }
}
