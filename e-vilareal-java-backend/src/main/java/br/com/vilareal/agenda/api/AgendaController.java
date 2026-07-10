package br.com.vilareal.agenda.api;

import br.com.vilareal.agenda.api.dto.AgendaEventoResponse;
import br.com.vilareal.agenda.api.dto.AgendaEventoWriteRequest;
import br.com.vilareal.agenda.api.dto.AgendaMensalResponse;
import br.com.vilareal.agenda.application.AgendaApplicationService;
import br.com.vilareal.agenda.application.ProcessoAudienciaAgendaSyncService;
import br.com.vilareal.common.exception.BusinessRuleException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/agenda/eventos")
@Tag(name = "Agenda")
public class AgendaController {

    private final AgendaApplicationService agendaService;
    private final ProcessoAudienciaAgendaSyncService processoAudienciaAgendaSyncService;

    public AgendaController(
            AgendaApplicationService agendaService,
            ProcessoAudienciaAgendaSyncService processoAudienciaAgendaSyncService) {
        this.agendaService = agendaService;
        this.processoAudienciaAgendaSyncService = processoAudienciaAgendaSyncService;
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

    @PutMapping("/upsert-audiencia")
    @Operation(description = "Cria ou atualiza audiência de processo na agenda (1 registro por usuário + processo_ref).")
    public ResponseEntity<AgendaEventoResponse> upsertAudiencia(@Valid @RequestBody AgendaEventoWriteRequest request) {
        AgendaEventoResponse body = agendaService.upsertAudiencia(request);
        return ResponseEntity.ok(body);
    }

    @PutMapping("/{id}")
    public AgendaEventoResponse atualizar(@PathVariable Long id, @Valid @RequestBody AgendaEventoWriteRequest request) {
        return agendaService.atualizar(id, request);
    }

    @DeleteMapping("/todos")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    @Operation(description = "Remove todos os compromissos da agenda (apenas ADMIN). Para reimportar planilha.")
    public ResponseEntity<Map<String, Integer>> excluirTodos() {
        int removidos = agendaService.excluirTodosEventos();
        return ResponseEntity.ok(Map.of("removidos", removidos));
    }

    @DeleteMapping("/por-processo")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(description = "Remove compromissos da agenda vinculados a um processo (ex.: audiência apagada no formulário).")
    public void excluirPorProcesso(
            @RequestParam String processoRef,
            @RequestParam(defaultValue = "processos-audiencia") String origem) {
        agendaService.excluirPorProcessoRefEOrigem(processoRef, origem);
    }

    @PostMapping("/sincronizar-audiencia-processo/{processoId}")
    @Operation(description = "Espelha audiência do processo na agenda de todos os colaboradores (ou remove se sem data).")
    public Map<String, Object> sincronizarAudienciaProcesso(@PathVariable Long processoId) {
        var r = processoAudienciaAgendaSyncService.sincronizarProcesso(processoId);
        return Map.of(
                "colaboradoresSincronizados", r.colaboradoresSincronizados(),
                "eventosRemovidos", r.eventosRemovidos(),
                "audienciaRemovida", r.audienciaRemovida());
    }

    @PostMapping("/sincronizar-audiencias-processos")
    @Operation(description = "Backfill: espelha audiências dos processos ativos na agenda. Opcional: dataInicio/dataFim.")
    public Map<String, Object> sincronizarAudienciasProcessos(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFim,
            @RequestParam(defaultValue = "false") boolean todos) {
        var r = todos
                ? processoAudienciaAgendaSyncService.backfillTodosAtivosComAudiencia()
                : processoAudienciaAgendaSyncService.backfillPeriodo(dataInicio, dataFim);
        return Map.of(
                "processosProcessados", r.processosProcessados(),
                "colaboradoresSincronizados", r.colaboradoresSincronizados(),
                "eventosRemovidos", r.eventosRemovidos(),
                "falhas", r.falhas());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(description = "Remove o compromisso da agenda.")
    public void excluir(@PathVariable Long id) {
        agendaService.excluir(id);
    }
}
