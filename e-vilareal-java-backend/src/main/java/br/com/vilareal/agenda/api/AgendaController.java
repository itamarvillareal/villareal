package br.com.vilareal.agenda.api;

import br.com.vilareal.agenda.api.dto.AgendaEventoResponse;
import br.com.vilareal.agenda.api.dto.AgendaEventoWriteRequest;
import br.com.vilareal.agenda.api.dto.AgendaMensalResponse;
import br.com.vilareal.agenda.application.AgendaApplicationService;
import br.com.vilareal.common.exception.BusinessRuleException;
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
    @Operation(description = "Lista compromissos no intervalo [dataInicio, dataFim]. Com todosUsuarios=true, retorna todos os usuários (visão Geral); caso contrário, usuarioId é obrigatório.")
    public List<AgendaEventoResponse> listar(
            @RequestParam(value = "usuarioId", required = false) Long usuarioId,
            @RequestParam("dataInicio") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicio,
            @RequestParam("dataFim") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFim,
            @RequestParam(value = "todosUsuarios", defaultValue = "false") boolean todosUsuarios) {
        if (todosUsuarios) {
            return agendaService.listarTodosUsuariosNoPeriodo(dataInicio, dataFim);
        }
        if (usuarioId == null) {
            throw new BusinessRuleException("Informe usuarioId ou use todosUsuarios=true.");
        }
        return agendaService.listarPorUsuarioEPeriodo(usuarioId, dataInicio, dataFim);
    }

    @GetMapping("/mensal")
    @Operation(description = "Resumo do mês. Com todosUsuarios=true, agrega todos os usuários (Geral).")
    public AgendaMensalResponse mensal(
            @RequestParam(value = "usuarioId", required = false) Long usuarioId,
            @RequestParam int ano,
            @RequestParam int mes,
            @RequestParam(value = "todosUsuarios", defaultValue = "false") boolean todosUsuarios) {
        if (todosUsuarios) {
            return agendaService.resumoMensalTodosUsuarios(ano, mes);
        }
        if (usuarioId == null) {
            throw new BusinessRuleException("Informe usuarioId ou use todosUsuarios=true.");
        }
        return agendaService.resumoMensal(usuarioId, ano, mes);
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
