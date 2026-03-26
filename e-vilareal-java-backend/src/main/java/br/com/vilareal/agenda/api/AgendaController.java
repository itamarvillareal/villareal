package br.com.vilareal.agenda.api;

import br.com.vilareal.agenda.api.dto.AgendaEventoResponse;
import br.com.vilareal.agenda.api.dto.AgendaEventoWriteRequest;
import br.com.vilareal.agenda.application.AgendaApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/agenda/eventos")
@Tag(name = "Agenda")
public class AgendaController {

    private final AgendaApplicationService agendaService;

    public AgendaController(AgendaApplicationService agendaService) {
        this.agendaService = agendaService;
    }

    @GetMapping
    @Operation(description = "Lista compromissos do usuário no intervalo [dataInicio, dataFim] (yyyy-MM-dd). Compatível com React agendaRepository.")
    public List<AgendaEventoResponse> listar(
            @RequestParam("usuarioId") Long usuarioId,
            @RequestParam("dataInicio") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicio,
            @RequestParam("dataFim") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFim) {
        return agendaService.listarPorUsuarioEPeriodo(usuarioId, dataInicio, dataFim);
    }

    @PostMapping
    public ResponseEntity<AgendaEventoResponse> criar(@Valid @RequestBody AgendaEventoWriteRequest request) {
        AgendaEventoResponse body = agendaService.criar(request);
        URI uri = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(body.getId())
                .toUri();
        return ResponseEntity.created(uri).body(body);
    }

    @PutMapping("/{id}")
    public AgendaEventoResponse atualizar(@PathVariable Long id, @Valid @RequestBody AgendaEventoWriteRequest request) {
        return agendaService.atualizar(id, request);
    }
}
