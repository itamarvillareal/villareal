package br.com.vilareal.api.controller;

import br.com.vilareal.api.dto.DespesaLocacaoRequest;
import br.com.vilareal.api.dto.DespesaLocacaoResponse;
import br.com.vilareal.api.service.DespesaLocacaoService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/locacoes/despesas")
public class LocacaoDespesaController {
    private final DespesaLocacaoService despesaLocacaoService;

    public LocacaoDespesaController(DespesaLocacaoService despesaLocacaoService) {
        this.despesaLocacaoService = despesaLocacaoService;
    }

    @GetMapping
    public List<DespesaLocacaoResponse> listar(@RequestParam(required = false) Long contratoId) {
        return despesaLocacaoService.listar(contratoId);
    }

    @PostMapping
    public ResponseEntity<DespesaLocacaoResponse> criar(@Valid @RequestBody DespesaLocacaoRequest request) {
        DespesaLocacaoResponse r = despesaLocacaoService.criar(request);
        return ResponseEntity.created(URI.create("/api/locacoes/despesas/" + r.getId())).body(r);
    }

    @PutMapping("/{id}")
    public DespesaLocacaoResponse atualizar(@PathVariable Long id, @Valid @RequestBody DespesaLocacaoRequest request) {
        return despesaLocacaoService.atualizar(id, request);
    }
}
