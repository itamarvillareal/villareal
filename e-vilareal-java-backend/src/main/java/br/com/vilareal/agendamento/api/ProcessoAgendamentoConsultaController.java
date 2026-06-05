package br.com.vilareal.agendamento.api;

import br.com.vilareal.agendamento.api.dto.AgendamentoRequest;
import br.com.vilareal.agendamento.api.dto.AgendamentoResponse;
import br.com.vilareal.agendamento.api.dto.ConsultaPeriodicaHabilitadaDto;
import br.com.vilareal.agendamento.api.dto.ExecucaoResponse;
import br.com.vilareal.agendamento.application.AgendamentoConsultaApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/processos/{processoId}")
@Tag(name = "Agendamento de consulta", description = "Agendamentos e histórico de execuções por processo")
public class ProcessoAgendamentoConsultaController {

    private final AgendamentoConsultaApplicationService agendamentoConsultaApplicationService;

    public ProcessoAgendamentoConsultaController(AgendamentoConsultaApplicationService agendamentoConsultaApplicationService) {
        this.agendamentoConsultaApplicationService = agendamentoConsultaApplicationService;
    }

    @PostMapping("/agendamentos")
    @Operation(summary = "Criar agendamento de consulta para o processo")
    public ResponseEntity<AgendamentoResponse> criar(
            @PathVariable Long processoId, @Valid @RequestBody AgendamentoRequest request) {
        AgendamentoResponse body = agendamentoConsultaApplicationService.criar(processoId, request);
        URI location = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/api/agendamentos/{id}")
                .buildAndExpand(body.getId())
                .toUri();
        return ResponseEntity.created(location).body(body);
    }

    @GetMapping("/agendamentos")
    @Operation(summary = "Listar agendamentos do processo")
    public List<AgendamentoResponse> listar(@PathVariable Long processoId) {
        return agendamentoConsultaApplicationService.listarPorProcesso(processoId);
    }

    @GetMapping("/execucoes")
    @Operation(summary = "Histórico de execuções de consulta do processo (paginado, mais recente primeiro)")
    public Page<ExecucaoResponse> listarExecucoes(
            @PathVariable Long processoId,
            @PageableDefault(size = 20, sort = "iniciadaEm", direction = Sort.Direction.DESC) Pageable pageable) {
        return agendamentoConsultaApplicationService.listarExecucoesPorProcesso(processoId, pageable);
    }

    @GetMapping("/consulta-periodica/habilitada")
    @Operation(summary = "Interruptor mestre: consulta periódica ativa para o processo (painel + scheduler)")
    public ConsultaPeriodicaHabilitadaDto obterConsultaPeriodicaHabilitada(@PathVariable Long processoId) {
        return agendamentoConsultaApplicationService.obterConsultaPeriodicaHabilitada(processoId);
    }

    @PutMapping("/consulta-periodica/habilitada")
    @Operation(summary = "Atualiza interruptor mestre da consulta periódica (não apaga histórico de execuções)")
    public ConsultaPeriodicaHabilitadaDto atualizarConsultaPeriodicaHabilitada(
            @PathVariable Long processoId, @RequestBody ConsultaPeriodicaHabilitadaDto body) {
        return agendamentoConsultaApplicationService.atualizarConsultaPeriodicaHabilitada(
                processoId, body.isHabilitada());
    }
}
