package br.com.vilareal.agendamento.api;

import br.com.vilareal.agendamento.api.dto.AgendamentoRequest;
import br.com.vilareal.agendamento.api.dto.AgendamentoResponse;
import br.com.vilareal.agendamento.api.dto.ConsultaExtraPainelResponse;
import br.com.vilareal.agendamento.api.dto.ExecucaoResponse;
import br.com.vilareal.agendamento.api.dto.PainelItemResponse;
import br.com.vilareal.agendamento.application.AgendamentoConsultaApplicationService;
import br.com.vilareal.agendamento.application.ConsultaPeriodicaMonitorScheduler;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/agendamentos")
@Tag(name = "Agendamento de consulta", description = "CRUD de agendamentos, painel e execuções por agendamento")
public class AgendamentoConsultaController {

    private final AgendamentoConsultaApplicationService agendamentoConsultaApplicationService;
    private final ConsultaPeriodicaMonitorScheduler consultaPeriodicaMonitorScheduler;

    public AgendamentoConsultaController(
            AgendamentoConsultaApplicationService agendamentoConsultaApplicationService,
            ConsultaPeriodicaMonitorScheduler consultaPeriodicaMonitorScheduler) {
        this.agendamentoConsultaApplicationService = agendamentoConsultaApplicationService;
        this.consultaPeriodicaMonitorScheduler = consultaPeriodicaMonitorScheduler;
    }

    @GetMapping("/painel")
    @Operation(summary = "Painel de bancada — agendamentos ativos com status resumido")
    public List<PainelItemResponse> painel() {
        return agendamentoConsultaApplicationService.montarPainel();
    }

    @PostMapping("/painel/consultar-agora")
    @Operation(summary = "Consulta extra imediata de todos os processos do painel (PROJUDI)")
    public ConsultaExtraPainelResponse consultarPainelAgora() {
        return consultaPeriodicaMonitorScheduler.executarConsultaExtraPainel();
    }

    @PutMapping("/{id}")
    @Operation(summary = "Editar agendamento")
    public AgendamentoResponse editar(@PathVariable Long id, @Valid @RequestBody AgendamentoRequest request) {
        return agendamentoConsultaApplicationService.editar(id, request);
    }

    @PostMapping("/{id}/pausar")
    @Operation(summary = "Pausar agendamento (ativo=false)")
    public AgendamentoResponse pausar(@PathVariable Long id) {
        return agendamentoConsultaApplicationService.pausar(id);
    }

    @PostMapping("/{id}/retomar")
    @Operation(summary = "Retomar agendamento (ativo=true e recalcula proxima_execucao)")
    public AgendamentoResponse retomar(@PathVariable Long id) {
        return agendamentoConsultaApplicationService.retomar(id);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Remover agendamento")
    public ResponseEntity<Void> remover(@PathVariable Long id) {
        agendamentoConsultaApplicationService.remover(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/execucoes")
    @Operation(summary = "Histórico de execuções do agendamento (paginado, mais recente primeiro)")
    public Page<ExecucaoResponse> listarExecucoes(
            @PathVariable Long id,
            @PageableDefault(size = 20, sort = "iniciadaEm", direction = Sort.Direction.DESC) Pageable pageable) {
        return agendamentoConsultaApplicationService.listarExecucoesPorAgendamento(id, pageable);
    }
}
