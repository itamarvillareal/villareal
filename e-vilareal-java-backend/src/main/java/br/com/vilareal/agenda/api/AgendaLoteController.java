package br.com.vilareal.agenda.api;

import br.com.vilareal.agenda.api.dto.AgendaLoteDetalheResponse;
import br.com.vilareal.agenda.api.dto.AgendaLoteResumoResponse;
import br.com.vilareal.agenda.application.AgendaLoteService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/agenda/lotes")
@Tag(name = "Agenda")
public class AgendaLoteController {

    private final AgendaLoteService agendaLoteService;

    public AgendaLoteController(AgendaLoteService agendaLoteService) {
        this.agendaLoteService = agendaLoteService;
    }

    @GetMapping
    @Operation(description = "Lista agendamentos em lote (origem agenda-lote:*).")
    public List<AgendaLoteResumoResponse> listar() {
        return agendaLoteService.listarResumos();
    }

    @GetMapping("/{loteRef}")
    @Operation(description = "Detalhe de um lote para edição ou cancelamento.")
    public AgendaLoteDetalheResponse obter(@PathVariable String loteRef) {
        return agendaLoteService.obterDetalhe(loteRef);
    }

    @DeleteMapping("/{loteRef}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(description = "Cancela compromissos futuros (hoje em diante) de um lote; passado é preservado.")
    public void excluir(@PathVariable String loteRef) {
        agendaLoteService.excluirLote(loteRef);
    }

    @DeleteMapping("/{loteRef}/contagem")
    @Operation(description = "Cancela compromissos futuros do lote e retorna quantidade removida (útil para UI).")
    public Map<String, Integer> excluirComContagem(@PathVariable String loteRef) {
        int removidos = agendaLoteService.excluirLote(loteRef);
        return Map.of("removidos", removidos);
    }
}
