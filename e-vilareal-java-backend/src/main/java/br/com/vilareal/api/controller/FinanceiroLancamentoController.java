package br.com.vilareal.api.controller;

import br.com.vilareal.api.dto.LancamentoFinanceiroRequest;
import br.com.vilareal.api.dto.LancamentoFinanceiroResponse;
import br.com.vilareal.api.dto.ResumoContaCorrenteProcessoResponse;
import br.com.vilareal.api.service.LancamentoFinanceiroService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/financeiro/lancamentos")
public class FinanceiroLancamentoController {
    private final LancamentoFinanceiroService lancamentoFinanceiroService;

    public FinanceiroLancamentoController(LancamentoFinanceiroService lancamentoFinanceiroService) {
        this.lancamentoFinanceiroService = lancamentoFinanceiroService;
    }

    @GetMapping
    public List<LancamentoFinanceiroResponse> listar(
            @RequestParam(required = false) Long clienteId,
            @RequestParam(required = false) Long processoId,
            @RequestParam(required = false) Long contaContabilId,
            @RequestParam(required = false) LocalDate dataInicio,
            @RequestParam(required = false) LocalDate dataFim
    ) {
        return lancamentoFinanceiroService.listar(clienteId, processoId, contaContabilId, dataInicio, dataFim);
    }

    @GetMapping("/{id}")
    public LancamentoFinanceiroResponse buscar(@PathVariable Long id) {
        return lancamentoFinanceiroService.buscar(id);
    }

    @PostMapping
    public ResponseEntity<LancamentoFinanceiroResponse> criar(@Valid @RequestBody LancamentoFinanceiroRequest request) {
        LancamentoFinanceiroResponse r = lancamentoFinanceiroService.criar(request);
        return ResponseEntity.created(URI.create("/api/financeiro/lancamentos/" + r.getId())).body(r);
    }

    @PutMapping("/{id}")
    public LancamentoFinanceiroResponse atualizar(@PathVariable Long id, @Valid @RequestBody LancamentoFinanceiroRequest request) {
        return lancamentoFinanceiroService.atualizar(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable Long id) {
        lancamentoFinanceiroService.excluir(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/resumo-processo/{processoId}")
    public ResumoContaCorrenteProcessoResponse resumirContaCorrenteProcesso(@PathVariable Long processoId) {
        return lancamentoFinanceiroService.resumirContaCorrenteProcesso(processoId);
    }
}
