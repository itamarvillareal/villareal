package br.com.vilareal.api.controller;

import br.com.vilareal.api.dto.AgendaEventoRequest;
import br.com.vilareal.api.dto.AgendaEventoResponse;
import br.com.vilareal.api.service.AgendaEventoService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/agenda/eventos")
public class AgendaEventoController {
    private final AgendaEventoService service;

    public AgendaEventoController(AgendaEventoService service) {
        this.service = service;
    }

    @GetMapping
    public List<AgendaEventoResponse> listar(
            @RequestParam Long usuarioId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFim) {
        return service.listar(usuarioId, dataInicio, dataFim);
    }

    @PostMapping
    public AgendaEventoResponse criar(@Valid @RequestBody AgendaEventoRequest request) {
        return service.criar(request);
    }

    @PutMapping("/{id}")
    public AgendaEventoResponse atualizar(@PathVariable Long id, @Valid @RequestBody AgendaEventoRequest request) {
        return service.atualizar(id, request);
    }

    @PatchMapping("/{id}/status-curto")
    public AgendaEventoResponse alterarStatusCurto(@PathVariable Long id, @RequestParam(required = false) String value) {
        return service.alterarStatusCurto(id, value);
    }

    @DeleteMapping("/{id}")
    public void excluir(@PathVariable Long id) {
        service.excluir(id);
    }
}
